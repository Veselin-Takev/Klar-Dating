import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { InAppNotification } from "../components/InAppNotification";

describe("InAppNotification", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("exposes native details semantics and pauses while details are open", () => {
    const onDismiss = vi.fn();
    render(
      <InAppNotification
        notification={{ title: "Hinweis", body: "Mehr Informationen" }}
        onDismiss={onDismiss}
      />,
    );

    const details = screen.getByRole("button", { name: "Details" });
    expect(details).toHaveAttribute("aria-expanded", "false");
    expect(details).toHaveAttribute("aria-controls");

    fireEvent.click(details);
    expect(screen.getByRole("button", { name: "Weniger" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );

    act(() => vi.advanceTimersByTime(60_000));
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it("pauses auto-dismiss on hover and resumes afterwards", () => {
    const onDismiss = vi.fn();
    const { container } = render(
      <InAppNotification
        notification={{ title: "Hinweis", message: "Text" }}
        onDismiss={onDismiss}
        timeoutMs={6_000}
      />,
    );

    const notification = container.querySelector('[role="status"]');
    expect(notification).not.toBeNull();

    act(() => vi.advanceTimersByTime(2_000));
    fireEvent.mouseEnter(notification!);
    act(() => vi.advanceTimersByTime(10_000));
    expect(onDismiss).not.toHaveBeenCalled();

    fireEvent.mouseLeave(notification!);
    act(() => vi.advanceTimersByTime(3_999));
    expect(onDismiss).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("never auto-dismisses persistent legal notifications", () => {
    const onDismiss = vi.fn();
    render(
      <InAppNotification
        notification={{ title: "Rechtliches Update", persistent: true }}
        onDismiss={onDismiss}
      />,
    );

    act(() => vi.advanceTimersByTime(120_000));
    expect(onDismiss).not.toHaveBeenCalled();

    fireEvent.click(
      screen.getByRole("button", { name: "Benachrichtigung schließen" }),
    );
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
  it("does not restart auto-dismiss when the parent supplies a new callback", () => {
    const firstDismiss = vi.fn();
    const latestDismiss = vi.fn();
    const notification = { title: "Hinweis", body: "Text" };
    const { rerender } = render(
      <InAppNotification notification={notification} onDismiss={firstDismiss} timeoutMs={6_000} />,
    );
    act(() => vi.advanceTimersByTime(4_000));
    rerender(<InAppNotification notification={notification} onDismiss={latestDismiss} timeoutMs={6_000} />);
    act(() => vi.advanceTimersByTime(1_999));
    expect(latestDismiss).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(firstDismiss).not.toHaveBeenCalled();
    expect(latestDismiss).toHaveBeenCalledTimes(1);
  });

});
