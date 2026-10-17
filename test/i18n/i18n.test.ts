import { createElement } from "react";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LocaleToggle } from "@/lib/i18n/client";
import { getLocale, LOCALE_COOKIE, t } from "@/lib/i18n/server";

const mocks = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.refresh }),
}));

describe("LOCALE_COOKIE", () => {
  it("is the cookie name the plan fixed", () => {
    expect(LOCALE_COOKIE).toBe("loo_locale");
  });
});

describe("getLocale", () => {
  it("reads an exact 'en' value from the cookie", () => {
    expect(getLocale(new Headers({ cookie: "loo_locale=en" }))).toBe("en");
    expect(getLocale(new Headers({ cookie: "theme=dark; loo_locale=en; x=1" }))).toBe("en");
  });

  it("prefers the cookie over accept-language", () => {
    expect(
      getLocale(new Headers({ cookie: "loo_locale=zh", "accept-language": "en-US,en;q=0.9" })),
    ).toBe("zh");
  });

  it("falls through cookie values that are not exactly 'zh' or 'en'", () => {
    expect(getLocale(new Headers({ cookie: "loo_locale=fr" }))).toBe("zh"); // no accept-language -> default
    expect(
      getLocale(new Headers({ cookie: "loo_locale=fr", "accept-language": "en-US" })),
    ).toBe("en");
    expect(getLocale(new Headers({ cookie: "loo_locale=EN" }))).toBe("zh"); // case-sensitive
    expect(getLocale(new Headers({ cookie: "loo_locale=zh-TW" }))).toBe("zh");
    expect(getLocale(new Headers({ cookie: "loo_locale=" }))).toBe("zh");
  });

  it("maps any accept-language token starting with 'zh' to 'zh'", () => {
    expect(getLocale(new Headers({ "accept-language": "zh-CN,zh;q=0.9,en;q=0.8" }))).toBe("zh");
    expect(getLocale(new Headers({ "accept-language": "en-US,en;q=0.9,zh-Hans;q=0.7" }))).toBe("zh");
    expect(getLocale(new Headers({ "accept-language": "zh-TW" }))).toBe("zh");
  });

  it("maps non-zh accept-language to 'en' and absent headers to 'zh'", () => {
    expect(getLocale(new Headers({ "accept-language": "en-US,en;q=0.9" }))).toBe("en");
    expect(getLocale(new Headers({ "accept-language": "fr-FR,fr;q=0.9" }))).toBe("en");
    expect(getLocale(new Headers())).toBe("zh");
  });
});

describe("t", () => {
  it("returns the English chrome string for a known key", () => {
    expect(t("nav.about", "en")).toBe("About");
  });

  it("returns the key itself when the key is missing", () => {
    expect(t("nonexistent.key", "zh")).toBe("nonexistent.key");
    expect(t("nonexistent.key", "en")).toBe("nonexistent.key");
  });

  const UI_KEYS = [
    "nav.about",
    "nav.home",
    "timeline.storyStart",
    "detail.back",
    "lightbox.close",
    "lightbox.prev",
    "lightbox.next",
    "lightbox.title",
    "admin.title",
    "admin.passcode",
    "admin.login",
    "admin.logout",
    "admin.newMoment",
    "admin.edit",
    "admin.delete",
    "admin.confirmDelete",
    "admin.date",
    "admin.titleZh",
    "admin.titleEn",
    "admin.descZh",
    "admin.descEn",
    "admin.pinned",
    "admin.images",
    "admin.save",
    "admin.tooManyImages",
    "admin.tooLarge",
    "admin.loginFailed",
    "about.title",
    "footer.builtWith",
  ];

  it.each(UI_KEYS)("resolves every planned chrome key in both locales", (key) => {
    expect(t(key, "zh")).not.toBe(key);
    expect(t(key, "zh").length).toBeGreaterThan(0);
    expect(t(key, "en")).not.toBe(key);
    expect(t(key, "en").length).toBeGreaterThan(0);
  });
});

describe("LocaleToggle", () => {
  let writes: string[];

  beforeEach(() => {
    writes = [];
    mocks.refresh.mockClear();
    const desc = Object.getOwnPropertyDescriptor(Document.prototype, "cookie");
    if (!desc || !desc.set || !desc.get) throw new Error("jsdom cookie accessor missing");
    const set = desc.set;
    const get = desc.get;
    Object.defineProperty(document, "cookie", {
      configurable: true,
      get: () => get.call(document),
      set: (value: string) => {
        writes.push(value);
        set.call(document, value);
      },
    });
  });

  afterEach(() => {
    Reflect.deleteProperty(document, "cookie");
    cleanup();
  });

  it("renders a zh and an en control", () => {
    const { getByRole } = render(createElement(LocaleToggle));
    expect(getByRole("button", { name: "中文" })).toBeTruthy();
    expect(getByRole("button", { name: "English" })).toBeTruthy();
  });

  it("writes loo_locale=en with the fixed attributes and refreshes the router", () => {
    const { getByRole } = render(createElement(LocaleToggle));
    fireEvent.click(getByRole("button", { name: "English" }));

    expect(writes.length).toBe(1);
    expect(writes[0]).toMatch(/^loo_locale=en;/);
    expect(writes[0]).toMatch(/path=\//);
    expect(writes[0]).toMatch(/max-age=31536000/);
    expect(writes[0]).toMatch(/samesite=lax/i);
    expect(mocks.refresh).toHaveBeenCalledTimes(1);
    expect(document.cookie).toContain("loo_locale=en");
  });

  it("writes loo_locale=zh when the zh control is clicked", () => {
    const { getByRole } = render(createElement(LocaleToggle));
    fireEvent.click(getByRole("button", { name: "中文" }));

    expect(writes.length).toBe(1);
    expect(writes[0]).toMatch(/^loo_locale=zh;/);
    expect(mocks.refresh).toHaveBeenCalledTimes(1);
  });
});
