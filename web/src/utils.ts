export function escapeAttribute(value: string): string {
    return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function setNoIndex(): void {
    let robots = document.querySelector<HTMLMetaElement>('meta[name="robots"]');
    if (!robots) {
        robots = document.createElement("meta");
        robots.name = "robots";
        document.head.append(robots);
    }
    robots.content = "noindex, nofollow";
}
