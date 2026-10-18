import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ExternalActions } from "./ExternalActions";
import { safeStoredDestination } from "@/lib/directory-links";

describe("stored external actions", () => {
  it("renders repeated HTTP and direct contact anchors without dispatching protocols", () => {
    render(
      <ExternalActions
        links={[
          { id: 1, label: "網站甲", url: "https://example.test" },
          { id: 2, label: "網站乙", url: "https://example.test/two" },
          { id: 3, label: "電話", url: "tel:+85212345678;ext=12" },
          {
            id: 4,
            label: "電郵",
            url: "mailto:fictional@example.test?subject=Hello&body=one%0D%0Atwo",
          },
          { id: 5, label: "停用", url: "https://example.test", enabled: false },
          { id: 6, label: "不安全", url: "javascript:alert(1)" },
        ]}
      />,
    );
    expect(screen.getByRole("link", { name: /網站甲/ })).toHaveAttribute(
      "href",
      "/out/1?source=web",
    );
    expect(screen.getByRole("link", { name: /網站乙/ })).toHaveAttribute(
      "href",
      "/out/2?source=web",
    );
    const phone = screen.getByRole("link", { name: /電話/ });
    expect(phone).toHaveAttribute("href", "tel:+85212345678;ext=12");
    expect(phone).not.toHaveAttribute("target");
    expect(screen.getByRole("link", { name: /電郵/ })).toHaveAttribute(
      "href",
      "mailto:fictional@example.test?subject=Hello&body=one%0D%0Atwo",
    );
    expect(screen.getAllByRole("link")).toHaveLength(4);
  });
  it.each([
    "mailto:a@example.test?subject=x%0d%0aBcc:b@example.test",
    "mailto:a@example.test%0A",
    "https://user:pass@example.test",
    "tel:123%00",
    "https://example.test/\npath",
  ])("rejects unsafe stored input %s", (value) => {
    expect(safeStoredDestination(value)).toBe(false);
  });
  it("keeps no-link listings valid", () => {
    const { container } = render(<ExternalActions links={[]} />);
    expect(container.querySelectorAll("a")).toHaveLength(0);
  });
});
