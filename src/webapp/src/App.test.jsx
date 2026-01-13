import { render, screen } from "@testing-library/react";
import App from "./App.jsx";

describe("App", () => {
  it("renders the header and status card", () => {
    render(<App />);

    expect(
      screen.getByRole("heading", { name: "Лабораторный контроль ИФА" })
    ).toBeInTheDocument();
    expect(screen.getByText("Статус подключения SDK")).toBeInTheDocument();
  });
});
