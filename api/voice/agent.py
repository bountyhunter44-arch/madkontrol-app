import os
import io
import time
import wave
import re
from html import escape
from typing import Any, Dict

import requests
import pygame
import speech_recognition as sr
import numpy as np
from scipy.signal import butter, lfilter
from openai import OpenAI
from fastapi import FastAPI, Request
from fastapi.responses import Response
from pydantic import BaseModel, Field

# ---------------------------------------------------------
# KONFIGURATION
# ---------------------------------------------------------
FIREBASE_PROJECT_ID = "lexivoice-27fc1"
FIREBASE_FUNCTIONS_REGION = "us-central1"

FIREBASE_ID_TOKEN = os.getenv("FIREBASE_ID_TOKEN", "").strip()

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "").strip()

LISTEN_TIMEOUT_SECONDS = 5
PHRASE_TIME_LIMIT_SECONDS = 6
FUNCTION_TIMEOUT_SECONDS = 30
PUBLIC_BASE_URL = os.getenv("PUBLIC_BASE_URL", "").strip().rstrip("/")

DOCUMENT_ROUTES = {
    "send_email",
    "email",
    "mail",
    "e-mail",
    "email_draft",
    "buildlexidocumentdraft",
    "build_document_draft",
    "complaint_letter",
    "klagebrev",
    "report",
    "rapport",
    "documentation",
    "dokumentation",
    "legal_reply",
    "juridisk_svar",
    "juridisk svar",
    "draft_document",
    "draft document",
    "document_draft",
    "write_letter",
    "brev",
}

ANALYSIS_ROUTES = {
    "analyzelexidocument",
    "analyze_document",
    "document_analysis",
    "analyze",
    "analyse",
}

STATUS_CAPABILITY_PROMPT = (
    "Du har adgang til kundens driftsstatus via funktionen getLexiCustomerStatus. "
    "Brug statusfelterne til at vurdere om der mangler opgaver i dag."
)


# ---------------------------------------------------------
# DIGITALT FILTER
# ---------------------------------------------------------
def butter_highpass_filter(data, cutoff, fs, order=5):
    nyq = 0.5 * fs
    normal_cutoff = cutoff / nyq
    if normal_cutoff <= 0 or normal_cutoff >= 1:
        return data
    b, a = butter(order, normal_cutoff, btype="high", analog=False)
    return lfilter(b, a, data)


# ---------------------------------------------------------
# SPEAKER
# ---------------------------------------------------------
class OpenAISpeaker:
    def __init__(self):
        if not OPENAI_API_KEY:
            raise RuntimeError("OPENAI_API_KEY mangler i miljoevariabler.")
        self.client = OpenAI(api_key=OPENAI_API_KEY)
        if not pygame.mixer.get_init():
            pygame.mixer.init()

    def speak(self, text):
        text = str(text or "").strip()
        if not text:
            return

        print(f"AI: {text}")
        try:
            response = self.client.audio.speech.create(
                model="tts-1",
                voice="shimmer",
                input=text,
            )
            byte_stream = io.BytesIO(response.content)
            pygame.mixer.music.load(byte_stream)
            pygame.mixer.music.play()

            while pygame.mixer.music.get_busy():
                pygame.time.Clock().tick(10)

        except Exception as e:
            print(f"Stemme-fejl: {e}")


# ---------------------------------------------------------
# FIREBASE CALLABLE CLIENT
# ---------------------------------------------------------
class FirebaseCallableClient:
    def __init__(self):
        self.session = requests.Session()
        self.base_headers = {
            "Content-Type": "application/json",
        }
        if FIREBASE_ID_TOKEN:
            self.base_headers["Authorization"] = f"Bearer {FIREBASE_ID_TOKEN}"

    def call(self, function_name, data):
        url = (
            f"https://{FIREBASE_FUNCTIONS_REGION}-"
            f"{FIREBASE_PROJECT_ID}.cloudfunctions.net/{function_name}"
        )

        print(f"Kalder backend: {function_name}")
        try:
            response = self.session.post(
                url,
                json={"data": data},
                headers=self.base_headers,
                timeout=FUNCTION_TIMEOUT_SECONDS,
            )

            print(f"{function_name} status: {response.status_code}")

            raw_text = response.text
            if not response.ok:
                print(f"Cloud Function fejl i {function_name}: {raw_text}")
                return None

            body = response.json()

            if "result" in body:
                return body["result"]

            print(f"Uventet Firebase-svar fra {function_name}: {body}")
            return None

        except requests.Timeout:
            print(f"Timeout ved kald til {function_name}")
            return None
        except Exception as e:
            print(f"Forbindelsesfejl til Firebase ({function_name}): {e}")
            return None

    def get_customer_context(self, company_id, location_id):
        if FIREBASE_ID_TOKEN:
            result = self.call(
                "getLexiCustomerStatus",
                {"companyId": company_id, "locationId": location_id},
            )
            if result:
                return result.get("result") if "result" in result else result

        madkontrol_base_url = os.getenv("MADKONTROL_API_BASE_URL", "").strip().rstrip("/")
        if not madkontrol_base_url:
            print("MADKONTROL_API_BASE_URL mangler i miljoevariabler.")
            return None

        url = f"{madkontrol_base_url}/lexivoice/customer-context"
        madkontrol_api_key = os.getenv("MADKONTROL_API_KEY", "").strip()
        headers = {}
        if madkontrol_api_key:
            headers["x-api-key"] = madkontrol_api_key

        try:
            response = self.session.get(
                url,
                params={"companyId": company_id, "locationId": location_id},
                headers=headers,
                timeout=FUNCTION_TIMEOUT_SECONDS,
            )

            if not response.ok:
                print(f"Madkontrol HTTP endpoint fejl: {response.status_code}")
                return None

            body = response.json()
            if body.get("ok") is not True:
                print(f"Madkontrol HTTP endpoint ikke ok: {body}")
                return None

            return body
        except requests.Timeout:
            print("Timeout ved Madkontrol HTTP endpoint")
            return None
        except Exception as e:
            print(f"Fejl ved Madkontrol HTTP endpoint: {e}")
            return None


# ---------------------------------------------------------
# HJAELPERE
# ---------------------------------------------------------
def normalize_transcript_text(text):
    value = str(text or "").lower().strip()
    value = value.replace("ae", "ae").replace("oe", "oe").replace("aa", "aa")
    value = re.sub(r"[\.,!?;:()\"'`/_\-]+", " ", value)
    value = re.sub(r"\s+", " ", value).strip()
    return value


def should_ignore_transcript(text):
    original = str(text or "").strip()
    normalized = normalize_transcript_text(original)

    if not normalized:
        return True

    words = normalized.split()

    # For korte inputs
    if len(normalized) < 8:
        return True

    if len(words) < 2:
        return True

    # Kendte fyldord / smaa nonsens-inputs
    filler_words = {
        "oeh",
        "uh",
        "hm",
        "hmm",
        "mmm",
        "ah",
        "eh",
        "ja",
        "nej",
        "ok",
        "okay",
        "tak",
        "hey",
    }

    if all(word in filler_words for word in words):
        return True

    # Kendte stoej-/undertekst-fraser
    blocked_patterns = [
        "amara",
        "amara org",
        "amaraorg",
        "undertekster af amara",
        "tekster af amara",
        "subtitles by amara",
        "community subtitles",
        "for flere tekster",
        "abonner",
        "abonnere",
        "subscribe",
    ]

    if any(pattern in normalized for pattern in blocked_patterns):
        return True

    # Meget gentagne nonsensord, fx "hvi hvi hvi"
    unique_words = set(words)
    if len(words) >= 4 and len(unique_words) <= 2:
        return True

    return False


def looks_like_document_command(text):
    value = normalize_transcript_text(text)

    action_phrases = [
        "skriv",
        "lav",
        "send",
        "formuler",
        "hjaelp mig med",
        "kan du skrive",
        "kan du lave",
        "kan du formulere",
        "jeg vil skrive",
        "jeg skal skrive",
        "jeg vil sende",
        "jeg skal sende",
    ]

    document_words = [
        "mail",
        "e mail",
        "email",
        "brev",
        "klage",
        "klagebrev",
        "rapport",
        "dokumentation",
        "notat",
        "svar",
        "anmodning",
        "opfoelgning",
        "rykker",
        "henvendelse",
        "udkast",
        "kladde",
        "tekst",
        "kommune",
        "jobcenter",
        "sagsbehandler",
    ]

    has_action = any(phrase in value for phrase in action_phrases)
    has_document_word = any(word in value for word in document_words)

    return has_action or has_document_word


def build_wav_from_audio(audio_raw):
    raw_data = np.frombuffer(audio_raw.get_raw_data(), dtype=np.int16)
    filtered_data = butter_highpass_filter(
        raw_data,
        cutoff=150,
        fs=audio_raw.sample_rate,
        order=5,
    )

    wav_io = io.BytesIO()
    with wave.open(wav_io, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(audio_raw.sample_rate)
        wf.writeframes(filtered_data.astype(np.int16).tobytes())

    wav_io.seek(0)
    wav_io.name = "audio.wav"
    return wav_io


def get_route_name(route_result):
    if not route_result:
        return ""

    return str(
        route_result.get("route")
        or route_result.get("intent")
        or route_result.get("action")
        or ""
    ).strip()


def infer_draft_type_from_route_and_text(route_name, speech_text):
    route_name = str(route_name or "").strip().lower()
    lower = str(speech_text or "").strip().lower()

    if route_name in ["send_email", "email", "mail", "e-mail", "email_draft"]:
        return "e-mail kladde"
    if route_name in ["complaint_letter", "klagebrev"]:
        return "klagebrev"
    if route_name in ["report", "rapport"]:
        return "rapport"
    if route_name in ["documentation", "dokumentation"]:
        return "dokumentation"
    if route_name in ["legal_reply", "juridisk_svar", "juridisk svar"]:
        return "juridisk svar"

    if "klagebrev" in lower:
        return "klagebrev"
    if "rapport" in lower:
        return "rapport"
    if "dokumentation" in lower:
        return "dokumentation"
    if "juridisk svar" in lower or "juridisk" in lower:
        return "juridisk svar"
    if "tilbud" in lower:
        return "tilbud"
    if "foraeldrebrev" in lower or "foraeldre brev" in lower:
        return "foraeldrebrev"
    if "undervisningsforloeb" in lower or "undervisningsforlob" in lower:
        return "undervisningsforloeb"
    if "printklar" in lower:
        return "printklar tekst"
    if "mail" in lower or "e-mail" in lower or "email" in lower or "brev" in lower:
        return "e-mail kladde"

    return "e-mail kladde"


def build_argument_pack_from_text(speech_text, draft_type):
    text = str(speech_text or "").strip()
    label = draft_type or "dokument"

    return {
        "title": text[:120],
        "arguments": [text],
        "keyArguments": [text],
        "goals": [f"Skriv en klar og professionel {label}."],
        "desiredOutcome": [f"En faerdig {label} som kan bruges eller redigeres videre."],
        "evidence": [],
        "documentation": [],
        "nextSteps": ["Gennemgaa kladden og tilpas modtager eller detaljer efter behov."],
    }


def build_context_payload():
    return {
        "source": "api/voice/agent.py",
        "mode": "document-assistant",
        "systemPrompt": STATUS_CAPABILITY_PROMPT,
    }


def print_draft_result(draft_result):
    print("\nDOKUMENTKLADDE")
    print("-" * 60)
    print(f"Titel: {draft_result.get('title', '')}")
    print(f"Emne: {draft_result.get('subject', '')}")
    print("-" * 60)
    print(draft_result.get("draftText", ""))
    print("-" * 60 + "\n")


def speak_analysis_result(speaker, analysis_result):
    analysis = (analysis_result or {}).get("analysis", {})
    spoken_summary = (
        analysis.get("spokenSummary")
        or analysis.get("summary")
        or "Dokumentet er analyseret."
    )
    speaker.speak(spoken_summary)


def generate_document_draft(firebase, speech_text, route_name):
    draft_type = infer_draft_type_from_route_and_text(route_name, speech_text)
    print(f"Valgt draftType: {draft_type}")

    analysis_result = firebase.call(
        "analyzeLexiDocument", {"text": speech_text, "context": build_context_payload()}
    )

    if not analysis_result:
        return {
            "status": "error",
            "message": "Jeg kunne ikke analysere teksten.",
        }

    draft_result = firebase.call(
        "buildLexiDocumentDraft",
        {
            "draftType": draft_type,
            "tone": "professionel",
            "recipient": "",
            "documentAnalysis": analysis_result.get("analysis", {}),
            "argumentPack": build_argument_pack_from_text(speech_text, draft_type),
        },
    )

    if not draft_result:
        return {
            "status": "error",
            "message": "Jeg kunne ikke bygge dokumentkladden.",
        }

    print_draft_result(draft_result)
    return {
        "status": "ok",
        "kind": "document_draft",
        "draftType": draft_type,
        "spokenSummary": draft_result.get("spokenSummary") or f"Jeg har lavet en {draft_type}.",
        "route": route_name,
        "routeResult": {},
        "draft": {
            "title": draft_result.get("title", ""),
            "subject": draft_result.get("subject", ""),
            "draftText": draft_result.get("draftText", ""),
        },
    }


def process_text_request(firebase, speech_text):
    text = str(speech_text or "").strip()
    if not text:
        return {
            "status": "error",
            "message": "Tom tekst er ikke tilladt.",
        }

    if should_ignore_transcript(text):
        return {
            "status": "ignored",
            "reason": "noise_or_filler",
            "message": "Input blev ignoreret som stoey eller fyldord.",
        }

    if not looks_like_document_command(text):
        return {
            "status": "ignored",
            "reason": "not_document_command",
            "message": "Input ligner ikke en dokumentkommando.",
        }

    route_result = firebase.call(
        "routeLexiIntent", {"text": text, "context": build_context_payload()}
    )
    if not route_result:
        return {
            "status": "error",
            "message": "Backend svarede ikke paa rute-kaldet.",
        }

    route_name = get_route_name(route_result).lower()
    if not route_name:
        return {
            "status": "error",
            "message": "Jeg kunne ikke finde den rigtige dokumenthandling.",
            "routeResult": route_result,
        }

    if route_name in DOCUMENT_ROUTES:
        result = generate_document_draft(firebase, text, route_name)
        result["routeResult"] = route_result
        return result

    if route_name in ANALYSIS_ROUTES or "analy" in route_name or "analys" in route_name:
        analysis_result = firebase.call(
            "analyzeLexiDocument", {"text": text, "context": build_context_payload()}
        )

        if not analysis_result:
            return {
                "status": "error",
                "message": "Jeg kunne ikke analysere dokumentet.",
                "route": route_name,
                "routeResult": route_result,
            }

        analysis = (analysis_result or {}).get("analysis", {})
        spoken_summary = (
            analysis.get("spokenSummary")
            or analysis.get("summary")
            or "Dokumentet er analyseret."
        )

        return {
            "status": "ok",
            "kind": "document_analysis",
            "spokenSummary": spoken_summary,
            "route": route_name,
            "routeResult": route_result,
            "analysis": analysis,
        }

    if (
        "email" in route_name
        or "mail" in route_name
        or "brev" in route_name
        or "build" in route_name
        or "draft" in route_name
        or "document" in route_name
    ):
        result = generate_document_draft(firebase, text, route_name)
        result["routeResult"] = route_result
        return result

    return {
        "status": "error",
        "message": "Jeg forstod beskeden, men kunne ikke finde den rigtige dokumenthandling.",
        "route": route_name,
        "routeResult": route_result,
    }


class VoiceWebhookRequest(BaseModel):
    text: str = Field(..., min_length=1)


class CustomerContextRequest(BaseModel):
    companyId: str = Field(..., min_length=1)
    locationId: str = Field(..., min_length=1)


app = FastAPI(title="Madkontrollen Voice Agent", version="1.0.0")


@app.get("/health")
def healthcheck() -> Dict[str, Any]:
    return {
        "ok": True,
        "service": "voice-agent",
        "mode": "webhook",
    }


@app.post("/webhook/voice")
def webhook_voice(payload: VoiceWebhookRequest) -> Dict[str, Any]:
    firebase = FirebaseCallableClient()
    result = process_text_request(firebase, payload.text)
    return {
        "ok": result.get("status") == "ok",
        **result,
    }


@app.post("/webhook/customer-context")
def webhook_customer_context(payload: CustomerContextRequest) -> Dict[str, Any]:
    firebase = FirebaseCallableClient()
    result = firebase.get_customer_context(payload.companyId, payload.locationId)

    if not result:
        return {
            "ok": False,
            "status": "error",
            "message": "Kunne ikke hente kundens status og rutiner fra Madkontrol."
        }

    return result


def xml_response(text: str) -> Response:
    return Response(content=text, media_type="application/xml")


def twiml_say_and_gather(prompt: str, action_path: str = "/twilio/process") -> str:
    escaped_prompt = escape(prompt)
    action_url = f"{PUBLIC_BASE_URL}{action_path}" if PUBLIC_BASE_URL else action_path
    return (
        "<?xml version=\"1.0\" encoding=\"UTF-8\"?>"
        "<Response>"
        f"<Gather input=\"speech\" language=\"da-DK\" speechTimeout=\"auto\" method=\"POST\" action=\"{escape(action_url)}\">"
        f"<Say language=\"da-DK\">{escaped_prompt}</Say>"
        "</Gather>"
        "<Pause length=\"1\"/>"
        "<Say language=\"da-DK\">Jeg horte ikke noget. Farvel.</Say>"
        "</Response>"
    )


def twiml_say_then_hangup(message: str) -> str:
    return (
        "<?xml version=\"1.0\" encoding=\"UTF-8\"?>"
        "<Response>"
        f"<Say language=\"da-DK\">{escape(message)}</Say>"
        "<Hangup/>"
        "</Response>"
    )


@app.post("/twilio/voice")
async def twilio_voice() -> Response:
    return xml_response(
        twiml_say_and_gather(
            "Velkommen til Madkontrollen. Fortael kort hvad du vil have hjaelp til."
        )
    )


@app.post("/twilio/process")
async def twilio_process(request: Request) -> Response:
    form = await request.form()
    speech_text = str(form.get("SpeechResult") or "").strip()

    if not speech_text:
        return xml_response(
            twiml_say_and_gather(
                "Jeg fik ikke din besked. Sig det igen efter tonen."
            )
        )

    firebase = FirebaseCallableClient()
    result = process_text_request(firebase, speech_text)

    if result.get("status") == "ok":
        spoken = str(result.get("spokenSummary") or "Faerdig.")
        return xml_response(twiml_say_then_hangup(spoken))

    if result.get("status") == "ignored":
        return xml_response(
            twiml_say_and_gather(
                "Jeg kunne ikke bruge den besked. Proev igen med en konkret opgave."
            )
        )

    message = str(result.get("message") or "Der opstod en fejl i behandlingen.")
    return xml_response(twiml_say_then_hangup(message))


def handle_document_generation(firebase, speaker, speech_text, route_name):
    result = generate_document_draft(firebase, speech_text, route_name)
    if result.get("status") != "ok":
        speaker.speak(result.get("message", "Der opstod en fejl."))
        return
    speaker.speak(result.get("spokenSummary", "Jeg har lavet en dokumentkladde."))


def handle_route_and_response(firebase, speaker, speech_text):
    result = process_text_request(firebase, speech_text)
    if result.get("status") == "ok":
        speaker.speak(result.get("spokenSummary", "Faerdig."))
        return
    if result.get("status") == "ignored":
        print(result.get("message", "Input ignoreret."))
        return
    speaker.speak(result.get("message", "Jeg kunne ikke behandle beskeden."))


# ---------------------------------------------------------
# HOVED-LOOP
# ---------------------------------------------------------
def start_lexivoice():
    if not OPENAI_API_KEY:
        raise RuntimeError("OPENAI_API_KEY mangler i miljoevariabler.")

    speaker = OpenAISpeaker()
    firebase = FirebaseCallableClient()
    client = OpenAI(api_key=OPENAI_API_KEY)

    recognizer = sr.Recognizer()
    recognizer.energy_threshold = 1500
    recognizer.dynamic_energy_threshold = False
    recognizer.pause_threshold = 0.8
    recognizer.non_speaking_duration = 0.5

    print("\n--- LexiVoice PRO Online ---")
    speaker.speak("Jeg lytter nu.")

    while True:
        try:
            with sr.Microphone() as source:
                print("Kalibrerer mikrofon...")
                recognizer.adjust_for_ambient_noise(source, duration=0.6)

                print("Venter paa tale...")
                try:
                    audio_raw = recognizer.listen(
                        source,
                        timeout=LISTEN_TIMEOUT_SECONDS,
                        phrase_time_limit=PHRASE_TIME_LIMIT_SECONDS,
                    )
                except sr.WaitTimeoutError:
                    print("Ingen tale registreret.")
                    continue

                print("Lyd modtaget")
                wav_io = build_wav_from_audio(audio_raw)

                print("Transskriberer...")
                transcript = client.audio.transcriptions.create(
                    model="whisper-1", file=wav_io, language="da"
                )

                speech_text = str(transcript.text or "").strip()

                if should_ignore_transcript(speech_text):
                    print(f"Ignoreret transcript: {speech_text}")
                    continue

                if not looks_like_document_command(speech_text):
                    print(f"Ignoreret som ikke-dokumentkommando: {speech_text}")
                    continue

                print(f"Hoert: {speech_text}")
                handle_route_and_response(firebase, speaker, speech_text)

        except KeyboardInterrupt:
            print("\nLexiVoice stoppet af bruger.")
            break
        except Exception as e:
            print(f"Uventet fejl i hoved-loop: {e}")
            time.sleep(1)


if __name__ == "__main__":
    mode = os.getenv("LEXIVOICE_MODE", "microphone").strip().lower()
    if mode == "webhook":
        import uvicorn

        host = os.getenv("VOICE_HOST", "0.0.0.0")
        port = int(os.getenv("VOICE_PORT", "8000"))
        uvicorn.run(app, host=host, port=port)
    else:
        start_lexivoice()
