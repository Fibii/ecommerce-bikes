import { render, screen } from "@testing-library/react";
import Home from "@/app/page";

describe("Home page", () => {
  it("shows the Bike configurator heading", () => {
    render(<Home />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Bike configurator" }),
    ).toBeInTheDocument();
  });
});
