import json
import time
from pathlib import Path
import requests

CONFIG_PATH = Path("config/connector.json")


def load_config():
    with open(CONFIG_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def read_file(workspace_root: Path, relative_path: str) -> str:
    target = (workspace_root / relative_path).resolve()
    workspace_root = workspace_root.resolve()

    if workspace_root not in target.parents and target != workspace_root:
        raise PermissionError("Path is outside workspace_root")

    if not target.exists():
        raise FileNotFoundError(f"File not found: {target}")

    return target.read_text(encoding="utf-8")


def main():
    config = load_config()

    base_url = config["base_url"].rstrip("/")
    token = config["token"]
    connector_id = config["connector_id"]
    device_name = config["device_name"]
    workspace_root = Path(config["workspace_root"])

    headers = {
        "Authorization": f"Bearer {token}"
    }

    print("Madkontrollen Connector startet")
    print("Server:", base_url)

    try:
        r = requests.post(
            f"{base_url}/connector/register",
            json={
                "connector_id": connector_id,
                "device_name": device_name
            },
            headers=headers,
            timeout=10,
        )
        print("Register:", r.text)
    except Exception as e:
        print("Register fejl:", e)

    while True:
        try:
            health = requests.get(
                f"{base_url}/health",
                headers=headers,
                timeout=10
            )
            print("Server status:", health.text)

            job_res = requests.get(
                f"{base_url}/connector/jobs/next/{connector_id}",
                headers=headers,
                timeout=10
            )
            job_data = job_res.json()

            if job_data.get("job") is None and job_data.get("ok") is True:
                time.sleep(config["poll_interval_seconds"])
                continue

            if job_data.get("type") == "read_file":
                job_id = job_data["id"]
                relative_path = job_data["relative_path"]

                print(f"Modtog read_file job: {relative_path}")

                try:
                    content = read_file(workspace_root, relative_path)

                    result = requests.post(
                        f"{base_url}/connector/jobs/result",
                        json={
                            "job_id": job_id,
                            "connector_id": connector_id,
                            "status": "completed",
                            "payload": {
                                "relative_path": relative_path,
                                "content": content
                            }
                        },
                        headers=headers,
                        timeout=20
                    )
                    print("Result sendt:", result.text)

                except Exception as file_error:
                    result = requests.post(
                        f"{base_url}/connector/jobs/result",
                        json={
                            "job_id": job_id,
                            "connector_id": connector_id,
                            "status": "failed",
                            "payload": {
                                "relative_path": relative_path,
                                "error": str(file_error)
                            }
                        },
                        headers=headers,
                        timeout=20
                    )
                    print("Fejl sendt:", result.text)

        except Exception as e:
            print("Fejl:", e)

        time.sleep(config["poll_interval_seconds"])


if __name__ == "__main__":
    main()