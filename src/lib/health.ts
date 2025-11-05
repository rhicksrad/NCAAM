function resolveTargetUrl(url: string): string {
  const absolutePattern = /^(?:https?:)?\/\//i;
  if (absolutePattern.test(url)) {
    return url;
  }

  if (typeof document !== "undefined" && typeof document.baseURI === "string") {
    try {
      return new URL(url, document.baseURI).toString();
    } catch {
      // fall through to other strategies
    }
  }

  if (typeof window !== "undefined" && typeof window.location?.href === "string") {
    try {
      return new URL(url, window.location.href).toString();
    } catch {
      // fall through to import.meta fallback
    }
  }

  if (typeof import.meta !== "undefined" && typeof import.meta.url === "string") {
    try {
      return new URL(url, import.meta.url).toString();
    } catch {
      // final fallback below
    }
  }

  return url;
}

function renderErrorCard(where: string, target: string, detail: string): void {
  if (typeof document === "undefined") {
    return;
  }

  const app = document.getElementById("app");
  if (!app) {
    return;
  }

  const existing = app.querySelector<HTMLDivElement>('.error-card[data-health-card="true"]');
  const card = existing ?? document.createElement("div");
  card.className = "error-card";
  card.dataset.healthCard = "true";
  card.setAttribute("role", "alert");

  card.innerHTML = "";

  const heading = document.createElement("p");
  heading.className = "error-card__title";
  heading.textContent = `${where} data check failed`;

  const message = document.createElement("p");
  message.className = "error-card__message";
  message.textContent = `Request for ${target} ${detail}.`;

  card.append(heading, message);

  if (!existing) {
    app.prepend(card);
  }
}

export async function requireOk(
  url: string,
  where: string,
  init?: RequestInit,
): Promise<Response> {
  const target = resolveTargetUrl(url);

  let response: Response;
  try {
    response = await fetch(target, init);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    renderErrorCard(where, target, `failed: ${reason}`);
    throw error;
  }

  if (!response.ok) {
    const statusText = response.statusText?.trim();
    const detail = statusText ? `${response.status} ${statusText}` : `${response.status}`;
    renderErrorCard(where, target, `returned ${detail}`);
    throw new Error(`requireOk(${where}) expected 200 for ${target} but received ${detail}`);
  }

  return response;
}
