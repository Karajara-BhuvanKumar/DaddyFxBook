import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PasswordForm } from "@/components/PasswordForm";
import { sendPasswordReset } from "@/lib/passwordReset";

const auth = vi.hoisted(() => ({ updateUser: vi.fn(), resetPasswordForEmail: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { auth } }));
afterEach(cleanup);
beforeEach(() => { vi.resetAllMocks(); auth.updateUser.mockResolvedValue({ error: null }); auth.resetPasswordForEmail.mockResolvedValue({ error: null }); });
function fill(password: string, confirm: string) {
  fireEvent.change(screen.getByLabelText("New password"), { target: { value: password } });
  fireEvent.change(screen.getByLabelText("Confirm new password"), { target: { value: confirm } });
  fireEvent.submit(screen.getByRole("button", { name: "Update password" }).closest("form")!);
}
describe("Account password controls", () => {
  it("rejects short and mismatched passwords before contacting auth", () => {
    render(<PasswordForm />);
    fill("short", "short");
    expect(screen.getByRole("alert")).toHaveTextContent("at least 8 characters");
    fill("long-enough-password", "different-password");
    expect(screen.getByRole("alert")).toHaveTextContent("don't match");
    expect(auth.updateUser).not.toHaveBeenCalled();
  });
  it("clears passwords and announces a successful update", async () => {
    const onSuccess = vi.fn(); render(<PasswordForm onSuccess={onSuccess} />);
    fill("long-enough-password", "long-enough-password");
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("updated"));
    expect(auth.updateUser).toHaveBeenCalledWith({ password: "long-enough-password" });
    expect(screen.getByLabelText("New password")).toHaveValue("");
    expect(screen.getByLabelText("Confirm new password")).toHaveValue("");
    expect(onSuccess).toHaveBeenCalledOnce();
  });
  it("preserves input on server failure so the user can retry", async () => {
    auth.updateUser.mockResolvedValueOnce({ error: new Error("Please reauthenticate") });
    render(<PasswordForm />); fill("long-enough-password", "long-enough-password");
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Please reauthenticate"));
    expect(screen.getByLabelText("New password")).toHaveValue("long-enough-password");
    expect(screen.getByRole("button", { name: "Update password" })).toBeEnabled();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
  it("disables the form while a password update is pending", async () => {
    let resolve!: (value: { error: null }) => void;
    auth.updateUser.mockReturnValueOnce(new Promise(r => { resolve = r; }));
    render(<PasswordForm />); fill("long-enough-password", "long-enough-password");
    expect(screen.getByRole("button", { name: "Updating…" })).toBeDisabled();
    expect(screen.getByLabelText("New password")).toBeDisabled();
    resolve({ error: null });
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("updated"));
  });
  it("sends reset links to the recovery route and propagates errors", async () => {
    await sendPasswordReset("trader@example.com");
    expect(auth.resetPasswordForEmail).toHaveBeenCalledWith("trader@example.com", { redirectTo: `${window.location.origin}/reset-password` });
    auth.resetPasswordForEmail.mockResolvedValueOnce({ error: new Error("Rate limit reached") });
    await expect(sendPasswordReset("trader@example.com")).rejects.toThrow("Rate limit reached");
  });
});
