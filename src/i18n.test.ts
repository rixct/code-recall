import { afterEach, describe, expect, it } from "vitest";
import { activeLang, resolveLang, setLangOverride, t } from "./i18n";

afterEach(() => setLangOverride("auto"));

describe("resolveLang", () => {
	it("maps Russian codes to ru and everything else to en", () => {
		expect(resolveLang("ru")).toBe("ru");
		expect(resolveLang("ru-RU")).toBe("ru");
		expect(resolveLang("en")).toBe("en");
		expect(resolveLang("de")).toBe("en");
		expect(resolveLang(null)).toBe("en");
		expect(resolveLang(undefined)).toBe("en");
	});
});

describe("language override", () => {
	it("forces the active language regardless of environment", () => {
		setLangOverride("ru");
		expect(activeLang()).toBe("ru");
		expect(t().again).toBe("Снова");

		setLangOverride("en");
		expect(activeLang()).toBe("en");
		expect(t().again).toBe("Again");
	});

	it("defaults to English when no window/localStorage is available", () => {
		setLangOverride("auto");
		expect(activeLang()).toBe("en");
	});
});
