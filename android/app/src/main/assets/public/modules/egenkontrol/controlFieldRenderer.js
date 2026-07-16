/**
 * controlFieldRenderer.js
 *
 * Renderer HTML UI baseret på field[]-definitioner fra control libraries.
 * Returnerer rene HTML-strenge — ingen Firestore, ingen business logic.
 *
 * Eksporter:
 *   renderField(field, value, context)    — renderer ét felt
 *   renderFields(fields, values, context) — renderer alle felter
 *   getDefaultValue(field)                — returnerer tom startværdi
 *
 * context: { disabled, showErrors, errors, mode }
 */

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @param {object}  field
 * @param {*}       [value]
 * @param {object}  [context]
 * @param {boolean} [context.disabled]
 * @param {boolean} [context.showErrors]
 * @param {object}  [context.errors]
 * @param {"edit"|"view"} [context.mode]
 * @returns {string} HTML
 */
export function renderField(field, value, context = {}) {
  const resolvedValue = value !== undefined ? value : getDefaultValue(field);
  const { disabled = false, showErrors = false, errors = {}, mode = "edit" } = context;
  const isDisabled = disabled || mode === "view";

  const showWhen = field.showWhen;
  const wrapperData = showWhen
    ? ` data-show-when-field="${a(showWhen.field)}" data-show-when-value="${a(showWhen.value)}" style="display:none"`
    : "";

  const labelHtml = _label(field);
  const inputHtml = _input(field, resolvedValue, isDisabled);
  const errorHtml = showErrors && errors[field.key]
    ? `<div class="error">${e(errors[field.key])}</div>`
    : "";

  if (field.type === "boolean") {
    return `<div class="field field--boolean"${wrapperData}>${inputHtml}${errorHtml}</div>`;
  }

  return `<div class="field field--${a(field.type)}"${wrapperData}>${labelHtml}${inputHtml}${errorHtml}</div>`;
}

/**
 * @param {object[]} fields
 * @param {object}   [values]
 * @param {object}   [context]
 * @returns {string} HTML
 */
export function renderFields(fields = [], values = {}, context = {}) {
  return fields.map((field) => renderField(field, values[field.key], context)).join("\n");
}

/**
 * @param {object} field
 * @returns {string|boolean|Array}
 */
export function getDefaultValue(field) {
  switch (field.type) {
    case "boolean":        return false;
    case "checkbox_group": return [];
    default:               return "";
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// LABEL
// ─────────────────────────────────────────────────────────────────────────────

function _label(field) {
  const req = field.required ? ' <span class="required" aria-hidden="true">*</span>' : "";
  return `<label for="field_${a(field.key)}">${e(field.label)}${req}</label>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// INPUT RENDERERS
// ─────────────────────────────────────────────────────────────────────────────

function _input(field, value, disabled) {
  switch (field.type) {
    case "text":           return _text(field, value, disabled);
    case "number":         return _number(field, value, disabled);
    case "textarea":       return _textarea(field, value, disabled);
    case "select":         return _select(field, value, disabled);
    case "radio_group":    return _radio(field, value, disabled);
    case "checkbox_group": return _checkbox(field, value, disabled);
    case "boolean":        return _boolean(field, value, disabled);
    case "photo":          return _photo(field, value, disabled);
    default:
      return `<p class="field-unknown">Ukendt felttype: ${e(field.type)}</p>`;
  }
}

function _text(field, value, disabled) {
  return `<input type="text" id="field_${a(field.key)}" name="${a(field.key)}" class="input" value="${a(String(value ?? ""))}" placeholder="${a(field.placeholder ?? "")}" ${field.required ? "required" : ""} ${disabled ? "disabled" : ""}>`;
}

function _number(field, value, disabled) {
  const unit = field.unit ? `<span class="unit">${e(field.unit === "C" ? "\u00b0C" : field.unit)}</span>` : "";
  return `<span class="input-with-unit"><input type="number" id="field_${a(field.key)}" name="${a(field.key)}" class="input" value="${a(String(value ?? ""))}" placeholder="${a(field.placeholder ?? "")}" step="0.1" ${field.required ? "required" : ""} ${disabled ? "disabled" : ""}>${unit}</span>`;
}

function _textarea(field, value, disabled) {
  return `<textarea id="field_${a(field.key)}" name="${a(field.key)}" class="textarea" rows="3" placeholder="${a(field.placeholder ?? "")}" ${field.required ? "required" : ""} ${disabled ? "disabled" : ""}>${e(String(value ?? ""))}</textarea>`;
}

function _select(field, value, disabled) {
  const opts = (field.options ?? []).map((opt) => {
    const sel = String(value ?? "") === opt ? " selected" : "";
    return `<option value="${a(opt)}"${sel}>${e(opt)}</option>`;
  }).join("");
  return `<select id="field_${a(field.key)}" name="${a(field.key)}" class="select" ${field.required ? "required" : ""} ${disabled ? "disabled" : ""}><option value="">— Vælg —</option>${opts}</select>`;
}

function _radio(field, value, disabled) {
  const items = (field.options ?? []).map((opt) => {
    const chk = String(value ?? "") === opt ? " checked" : "";
    return `<label class="radio-item"><input type="radio" name="${a(field.key)}" value="${a(opt)}"${chk}${disabled ? " disabled" : ""}><span>${e(opt)}</span></label>`;
  }).join("");
  return `<div class="radio-group" role="radiogroup">${items}</div>`;
}

function _checkbox(field, value, disabled) {
  const checked = Array.isArray(value) ? value : [];
  const items = (field.options ?? []).map((opt) => {
    const chk = checked.includes(opt) ? " checked" : "";
    return `<label class="check-item"><input type="checkbox" name="${a(field.key)}" value="${a(opt)}"${chk}${disabled ? " disabled" : ""}><span>${e(opt)}</span></label>`;
  }).join("");
  return `<div class="check-group">${items}</div>`;
}

function _boolean(field, value, disabled) {
  const chk = value === true || value === "true" ? " checked" : "";
  return `<label class="check-item check-item--boolean"><input type="checkbox" id="field_${a(field.key)}" name="${a(field.key)}" value="true"${chk}${disabled ? " disabled" : ""}><span>${e(field.label)}</span></label>`;
}

function _photo(field, value, disabled) {
  const urls = Array.isArray(value) ? value : (value ? [value] : []);
  const previews = urls.map((url) => `<img src="${a(String(url))}" alt="Foto" class="photo-preview">`).join("");
  const btn = disabled ? "" : `<label class="upload-box" for="field_${a(field.key)}">📷 ${urls.length > 0 ? "Tilføj foto" : "Kamera / upload"}</label><input type="file" id="field_${a(field.key)}" name="${a(field.key)}" accept="image/*" capture="environment" class="photo-input" style="display:none">`;
  return `<div class="photo-field" data-field-key="${a(field.key)}">${previews}${btn}</div>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// UTILS
// ─────────────────────────────────────────────────────────────────────────────

function e(v) {
  return String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function a(v) {
  return String(v ?? "").replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}
