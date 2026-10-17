import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  MomentLightbox,
  MomentLightboxTrigger,
  type LightboxLabels,
} from "@/components/MomentLightbox";

const labels: LightboxLabels = {
  title: "Image viewer",
  close: "Close",
  prev: "Previous",
  next: "Next",
};

const one = {
  src: "/api/asset/m1/01.png?w=1920",
  alt: "First plate",
  width: 1600,
  height: 900,
};
const two = {
  src: "/api/asset/m1/02.png?w=1920",
  alt: "Second plate",
  width: 1600,
  height: 900,
};

afterEach(cleanup);

describe("MomentLightbox", () => {
  it("renders an aria-modal dialog showing the first image at its given src", () => {
    render(<MomentLightbox images={[one, two]} labels={labels} onClose={() => {}} />);
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAccessibleName("Image viewer");
    const img = screen.getByRole("img", { name: "First plate" });
    expect(img).toHaveAttribute("src", one.src);
  });

  it("honors initialIndex and focuses its close button on open", () => {
    render(
      <MomentLightbox images={[one, two]} labels={labels} onClose={() => {}} initialIndex={1} />,
    );
    expect(screen.getByRole("img", { name: "Second plate" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Close" })).toHaveFocus();
  });

  it("returns focus to the element that was focused before open", () => {
    const opener = document.createElement("button");
    document.body.appendChild(opener);
    opener.focus();

    const { unmount } = render(
      <MomentLightbox images={[one]} labels={labels} onClose={() => {}} />,
    );
    expect(screen.getByRole("button", { name: "Close" })).toHaveFocus();

    unmount(); // the caller unmounts the dialog on close
    expect(document.activeElement).toBe(opener);
    opener.remove();
  });

  it("locks body scroll while open and restores it on close", () => {
    const { unmount } = render(
      <MomentLightbox images={[one]} labels={labels} onClose={() => {}} />,
    );
    expect(document.body.style.overflow).toBe("hidden");
    unmount();
    expect(document.body.style.overflow).toBe("");
  });

  it("cycles images with ArrowRight/ArrowLeft, wrapping at both ends", () => {
    render(<MomentLightbox images={[one, two]} labels={labels} onClose={() => {}} />);
    fireEvent.keyDown(document, { key: "ArrowRight" });
    expect(screen.getByRole("img", { name: "Second plate" })).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "ArrowRight" });
    expect(screen.getByRole("img", { name: "First plate" })).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "ArrowLeft" });
    expect(screen.getByRole("img", { name: "Second plate" })).toBeInTheDocument();
  });

  it("steps images with the prev/next buttons", () => {
    render(<MomentLightbox images={[one, two]} labels={labels} onClose={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByRole("img", { name: "Second plate" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Previous" }));
    expect(screen.getByRole("img", { name: "First plate" })).toBeInTheDocument();
  });

  it("closes on Escape and on the close button", () => {
    const onClose = vi.fn();
    render(<MomentLightbox images={[one]} labels={labels} onClose={onClose} />);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("closes on a backdrop click but not on a click on the image", () => {
    const onClose = vi.fn();
    render(<MomentLightbox images={[one]} labels={labels} onClose={onClose} />);
    fireEvent.click(screen.getByRole("img"));
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("dialog"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("hides prev/next and ignores arrow keys for a single image", () => {
    render(<MomentLightbox images={[one]} labels={labels} onClose={() => {}} />);
    expect(screen.queryByRole("button", { name: "Previous" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Next" })).not.toBeInTheDocument();
    fireEvent.keyDown(document, { key: "ArrowRight" });
    expect(screen.getByRole("img", { name: "First plate" })).toBeInTheDocument();
  });

  it("keeps Tab focus cycling inside the dialog", () => {
    render(<MomentLightbox images={[one, two]} labels={labels} onClose={() => {}} />);
    const close = screen.getByRole("button", { name: "Close" });
    const next = screen.getByRole("button", { name: "Next" });

    next.focus(); // DOM order: close, prev, next — Tab from last wraps to first
    fireEvent.keyDown(document, { key: "Tab" });
    expect(close).toHaveFocus();

    close.focus(); // Shift+Tab from first wraps to last
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(next).toHaveFocus();
  });
});

describe("MomentLightboxTrigger", () => {
  function renderTrigger() {
    return render(
      <MomentLightboxTrigger images={[one]} labels={labels}>
        {/* Hash href keeps jsdom quiet; interception logic only looks for
            `a[href]`, exactly like the real card link to /moments/<id>. */}
        <a href="#moments-m1" data-card="photo">
          Open the moment
        </a>
      </MomentLightboxTrigger>,
    );
  }

  it("renders no dialog until opened (nothing hidden in the initial markup)", () => {
    renderTrigger();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open the moment" })).toBeInTheDocument();
  });

  it("intercepts a plain left click on the link and opens the lightbox", () => {
    renderTrigger();
    const link = screen.getByRole("link", { name: "Open the moment" });
    link.focus();

    // fireEvent returns false when the event's default was prevented —
    // the link navigation must not happen.
    expect(fireEvent.click(link)).toBe(false);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "First plate" })).toHaveAttribute("src", one.src);

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(link).toHaveFocus(); // focus returns to the card link
  });

  it("leaves modifier clicks alone so new-tab navigation still works", () => {
    renderTrigger();
    const link = screen.getByRole("link", { name: "Open the moment" });
    expect(fireEvent.click(link, { ctrlKey: true })).toBe(true); // not prevented
    expect(fireEvent.click(link, { metaKey: true })).toBe(true);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("ignores clicks that do not land inside a link", () => {
    render(
      <MomentLightboxTrigger images={[one]} labels={labels}>
        <span>not a link</span>
      </MomentLightboxTrigger>,
    );
    fireEvent.click(screen.getByText("not a link"));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
