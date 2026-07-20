import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { getDeviceAtlasFixture } from "@/server/device-atlas/fixture";
import { DeviceAtlasPanel } from "./DeviceAtlasPanel";

describe("DeviceAtlasPanel", () => {
  it("explains privacy and keeps automation simulated", () => {
    render(<DeviceAtlasPanel snapshot={getDeviceAtlasFixture()} />);
    expect(
      screen.getByRole("heading", { name: "Orbit Device Atlas" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/does not retain IP or hardware addresses/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/No command was sent/i)).toBeInTheDocument();
    expect(screen.getAllByText("Entry lamp")).toHaveLength(2);
    expect(
      screen.getByText("Stable identity from one approved source"),
    ).toBeInTheDocument();
  });
});
