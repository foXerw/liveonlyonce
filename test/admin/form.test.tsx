import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import enMessages from "@/messages/en.json";
import { MomentForm } from "@/components/admin/MomentForm";
import { MAX_IMAGES, MAX_IMAGE_BYTES } from "@/lib/admin/limits";
import type { Moment } from "@/lib/types";

/**
 * MomentForm contract test. Field names are asserted verbatim against
 * lib/admin/form.ts: date / title[zh] / title[en] / description[zh] /
 * description[en] / location[zh] / location[en] / pinned / files[] plus the
 * PATCH directives removeFiles (repeatable) and replaceFiles.
 */

const msg = (key: string): string => {
  const value = (enMessages as Record<string, string>)[key];
  if (typeof value !== "string") throw new Error(`missing catalog key ${key}`);
  return value;
};

type FetchCall = [string, RequestInit];

let fetchMock: ReturnType<typeof vi.fn>;

function calls(): FetchCall[] {
  return fetchMock.mock.calls as unknown as FetchCall[];
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function smallFile(name: string): File {
  return new File([new Uint8Array(8)], name, { type: "image/jpeg" });
}

function oversizedFile(name: string): File {
  const file = smallFile(name);
  // File.size derives from content; shadow the prototype getter instead of
  // allocating 25 MB in the test.
  Object.defineProperty(file, "size", { value: MAX_IMAGE_BYTES + 1 });
  return file;
}

const existingMoment: Moment = {
  id: "2026-05-04-hiking",
  date: "2026-05-04",
  pinned: true,
  title: { zh: "登山", en: "Hiking" },
  description: { zh: "好累", en: "So tired" },
  location: { zh: "山里" },
  images: [
    { file: "01-a.jpg", width: 800, height: 600 },
    { file: "02-b.jpg", width: 600, height: 800 },
  ],
  kind: "album",
  poster: { file: "01-a.jpg", width: 800, height: 600 },
  posterAspect: "wide",
};

function fillCreateDefaults(): void {
  fireEvent.change(screen.getByLabelText(msg("admin.date")), {
    target: { value: "2026-05-04" },
  });
  fireEvent.change(screen.getByLabelText(msg("admin.titleZh")), {
    target: { value: "登山" },
  });
}

function lastFormData(): FormData {
  const all = calls();
  const body = all[all.length - 1][1].body;
  expect(body).toBeInstanceOf(FormData);
  return body as FormData;
}

let objectUrlDescriptor: PropertyDescriptor | undefined;

beforeEach(() => {
  fetchMock = vi.fn(async () => jsonResponse(200, { id: "2026-05-04-hiking" }));
  vi.stubGlobal("fetch", fetchMock);
  objectUrlDescriptor = Object.getOwnPropertyDescriptor(URL, "createObjectURL");
  Object.defineProperty(URL, "createObjectURL", {
    configurable: true,
    writable: true,
    value: (blob: Blob) => `blob:preview-${(blob as File).name}`,
  });
  Object.defineProperty(URL, "revokeObjectURL", {
    configurable: true,
    writable: true,
    value: () => {},
  });
});

afterEach(() => {
  if (objectUrlDescriptor) Object.defineProperty(URL, "createObjectURL", objectUrlDescriptor);
  else Reflect.deleteProperty(URL, "createObjectURL");
  Reflect.deleteProperty(URL, "revokeObjectURL");
  vi.unstubAllGlobals();
  cleanup();
});

describe("MomentForm create mode", () => {
  it("assembles a multipart body with the exact form.ts field names on submit", async () => {
    const onSaved = vi.fn();
    render(<MomentForm locale="en" onSaved={onSaved} onCancel={() => {}} />);

    fireEvent.change(screen.getByLabelText(msg("admin.date")), {
      target: { value: "2026-05-04" },
    });
    fireEvent.change(screen.getByLabelText(msg("admin.titleZh")), { target: { value: "登山" } });
    fireEvent.change(screen.getByLabelText(msg("admin.titleEn")), { target: { value: "Hiking" } });
    fireEvent.change(screen.getByLabelText(msg("admin.descZh")), { target: { value: "好累" } });
    fireEvent.change(screen.getByLabelText(msg("admin.descEn")), { target: { value: "Tired" } });
    fireEvent.change(screen.getByLabelText(msg("admin.locationZh")), { target: { value: "山里" } });
    fireEvent.change(screen.getByLabelText(msg("admin.locationEn")), { target: { value: "Hill" } });
    fireEvent.click(screen.getByLabelText(msg("admin.pinned")));

    const photo = smallFile("photo.jpg");
    fireEvent.change(screen.getByLabelText(msg("admin.images")), { target: { files: [photo] } });

    fireEvent.click(screen.getByRole("button", { name: msg("admin.save") }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    const [url, init] = calls()[0];
    expect(url).toBe("/api/admin/moments");
    expect(init.method).toBe("POST");

    const fd = lastFormData();
    expect(fd.get("date")).toBe("2026-05-04");
    expect(fd.get("title[zh]")).toBe("登山");
    expect(fd.get("title[en]")).toBe("Hiking");
    expect(fd.get("description[zh]")).toBe("好累");
    expect(fd.get("description[en]")).toBe("Tired");
    expect(fd.get("location[zh]")).toBe("山里");
    expect(fd.get("location[en]")).toBe("Hill");
    expect(fd.get("pinned")).toBe("true");
    expect(fd.getAll("files[]")).toEqual([photo]);
    // The whole record is always posted: unused text fields travel as empty
    // strings (lib/admin/form.ts trims them away server-side).
    expect(fd.get("removeFiles")).toBeNull();
    expect(fd.get("replaceFiles")).toBeNull();

    await waitFor(() => expect(onSaved).toHaveBeenCalledWith("2026-05-04-hiking"));
  });

  it("blocks submit and shows a validation message when both titles are empty", async () => {
    render(<MomentForm locale="en" onSaved={() => {}} onCancel={() => {}} />);

    // Date filled so ONLY the title rule can trip; no images.
    fireEvent.change(screen.getByLabelText(msg("admin.date")), {
      target: { value: "2026-05-04" },
    });
    fireEvent.click(screen.getByRole("button", { name: msg("admin.save") }));

    expect(screen.getByText(msg("admin.titleRequired"))).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();

    // Filling one locale clears the block on the next submit.
    fireEvent.change(screen.getByLabelText(msg("admin.titleEn")), { target: { value: "Hiking" } });
    fireEvent.click(screen.getByRole("button", { name: msg("admin.save") }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const fd = lastFormData();
    expect(fd.get("title[en]")).toBe("Hiking");
    expect(fd.get("pinned")).toBe("false"); // unchecked checkbox posts an explicit false
    expect(fd.get("description[zh]")).toBe(""); // blank whole-record fields still sent
  });

  it("blocks submit when the date is empty", () => {
    render(<MomentForm locale="en" onSaved={() => {}} onCancel={() => {}} />);

    fireEvent.change(screen.getByLabelText(msg("admin.titleZh")), { target: { value: "登山" } });
    fireEvent.click(screen.getByRole("button", { name: msg("admin.save") }));

    expect(screen.getByText(msg("admin.dateRequired"))).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("surfaces server field errors from the {error, fields} shape next to the inputs", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(400, {
        error: "validation failed",
        fields: { files: 'file extension must be one of jpg, jpeg, png, webp, got "x.jpg"' },
      }),
    );
    render(<MomentForm locale="en" onSaved={() => {}} onCancel={() => {}} />);

    fillCreateDefaults();
    fireEvent.change(screen.getByLabelText(msg("admin.images")), {
      target: { files: [smallFile("x.jpg")] },
    });
    fireEvent.click(screen.getByRole("button", { name: msg("admin.save") }));

    expect(
      await screen.findByText('file extension must be one of jpg, jpeg, png, webp, got "x.jpg"'),
    ).toBeInTheDocument();
    // The generic "validation failed" does not stack on top of the per-field text.
    expect(screen.queryByText("validation failed")).not.toBeInTheDocument();
  });
});

describe("MomentForm image pre-checks", () => {
  it("rejects an over-cap file, keeps the valid one, and reports admin.tooLarge", async () => {
    render(<MomentForm locale="en" onSaved={() => {}} onCancel={() => {}} />);

    fireEvent.change(screen.getByLabelText(msg("admin.images")), {
      target: { files: [smallFile("photo-ok.jpg"), oversizedFile("photo-big.jpg")] },
    });
    expect(screen.getByText(msg("admin.tooLarge"))).toBeInTheDocument();

    fillCreateDefaults();
    fireEvent.click(screen.getByRole("button", { name: msg("admin.save") }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const names = (lastFormData().getAll("files[]") as File[]).map((f) => f.name);
    expect(names).toEqual(["photo-ok.jpg"]);
  });

  it("reports admin.badImageType for a disallowed extension", async () => {
    render(<MomentForm locale="en" onSaved={() => {}} onCancel={() => {}} />);

    fireEvent.change(screen.getByLabelText(msg("admin.images")), {
      target: { files: [new File([new Uint8Array(8)], "notes.txt", { type: "text/plain" })] },
    });
    expect(screen.getByText(msg("admin.badImageType"))).toBeInTheDocument();

    fillCreateDefaults();
    fireEvent.click(screen.getByRole("button", { name: msg("admin.save") }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(lastFormData().getAll("files[]")).toEqual([]);
  });

  it("caps the selection at MAX_IMAGES and reports admin.tooManyImages", async () => {
    render(<MomentForm locale="en" onSaved={() => {}} onCancel={() => {}} />);

    const files = Array.from({ length: MAX_IMAGES + 1 }, (_, i) => smallFile(`p${i}.jpg`));
    fireEvent.change(screen.getByLabelText(msg("admin.images")), { target: { files } });

    expect(screen.getByText(msg("admin.tooManyImages"))).toBeInTheDocument();
    // Only MAX_IMAGES tiles survive, each with a remove button.
    expect(screen.getAllByRole("button", { name: msg("admin.removeImage") })).toHaveLength(
      MAX_IMAGES,
    );
  });

  it("renders previews for accepted files and drops them via the remove button", async () => {
    render(<MomentForm locale="en" onSaved={() => {}} onCancel={() => {}} />);

    const photo = smallFile("photo.jpg");
    fireEvent.change(screen.getByLabelText(msg("admin.images")), { target: { files: [photo] } });
    expect(screen.getByRole("img", { name: "photo.jpg" })).toHaveAttribute(
      "src",
      "blob:preview-photo.jpg",
    );

    fireEvent.click(screen.getByRole("button", { name: msg("admin.removeImage") }));
    expect(screen.queryByRole("img", { name: "photo.jpg" })).not.toBeInTheDocument();

    fillCreateDefaults();
    fireEvent.click(screen.getByRole("button", { name: msg("admin.save") }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(lastFormData().getAll("files[]")).toEqual([]);
  });

  it("counts kept existing images toward the MAX_IMAGES budget in edit mode", () => {
    render(
      <MomentForm
        locale="en"
        moment={existingMoment}
        onSaved={() => {}}
        onCancel={() => {}}
      />,
    );

    // existingMoment carries 2 images, so only MAX_IMAGES-2 new ones fit.
    const files = Array.from({ length: MAX_IMAGES - 1 }, (_, i) => smallFile(`p${i}.jpg`));
    fireEvent.change(screen.getByLabelText(msg("admin.images")), { target: { files } });
    expect(screen.getByText(msg("admin.tooManyImages"))).toBeInTheDocument();
  });
});

describe("MomentForm edit mode", () => {
  it("prefills from the moment and sends removeFiles (not replaceFiles) per the PATCH contract", async () => {
    const onSaved = vi.fn();
    render(
      <MomentForm
        locale="en"
        moment={existingMoment}
        onSaved={onSaved}
        onCancel={() => {}}
      />,
    );

    // Whole record prefills from the GET list payload.
    expect(screen.getByLabelText(msg("admin.date"))).toHaveValue("2026-05-04");
    expect(screen.getByLabelText(msg("admin.titleZh"))).toHaveValue("登山");
    expect(screen.getByLabelText(msg("admin.descEn"))).toHaveValue("So tired");
    expect(screen.getByLabelText(msg("admin.locationZh"))).toHaveValue("山里");
    expect(screen.getByLabelText(msg("admin.locationEn"))).toHaveValue("");
    expect(screen.getByLabelText(msg("admin.pinned"))).toBeChecked();
    expect(screen.getByText("01-a.jpg")).toBeInTheDocument();
    expect(screen.getByText("02-b.jpg")).toBeInTheDocument();

    // Mark the first existing image for removal, edit the title, submit.
    fireEvent.click(screen.getAllByRole("button", { name: msg("admin.removeImage") })[0]);
    fireEvent.change(screen.getByLabelText(msg("admin.titleZh")), { target: { value: "登山改" } });
    fireEvent.click(screen.getByRole("button", { name: msg("admin.save") }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = calls()[0];
    expect(url).toBe("/api/admin/moments/2026-05-04-hiking");
    expect(init.method).toBe("PATCH");

    const fd = lastFormData();
    expect(fd.get("date")).toBe("2026-05-04");
    expect(fd.get("title[zh]")).toBe("登山改");
    expect(fd.get("title[en]")).toBe("Hiking"); // untouched prefill still posted
    expect(fd.get("pinned")).toBe("true");
    expect(fd.getAll("removeFiles")).toEqual(["01-a.jpg"]); // repeatable string fields
    expect(fd.get("replaceFiles")).toBe("false"); // explicit: merge, do not wipe
    expect(fd.getAll("files[]")).toEqual([]); // no new files

    await waitFor(() => expect(onSaved).toHaveBeenCalledWith("2026-05-04-hiking"));
  });

  it("shows admin.saveFailed when the request throws (network down)", async () => {
    fetchMock.mockRejectedValueOnce(new Error("Failed to fetch"));
    render(<MomentForm locale="en" onSaved={() => {}} onCancel={() => {}} />);

    fillCreateDefaults();
    fireEvent.click(screen.getByRole("button", { name: msg("admin.save") }));

    expect(await screen.findByText(msg("admin.saveFailed"))).toBeInTheDocument();
  });
});
