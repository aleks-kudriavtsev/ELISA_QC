import { render, screen } from "@testing-library/react";
import App from "./App.jsx";

describe("App", () => {
  it("renders the header, navigation, and active screen", () => {
    render(<App />);

    expect(
      screen.getByRole("heading", { name: "Лабораторный контроль ИФА" })
    ).toBeInTheDocument();
    expect(screen.getByText("Статус подключения SDK")).toBeInTheDocument();
    expect(
      screen.getByRole("navigation", { name: "Маршруты" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Protocols", level: 2 })
    ).toBeInTheDocument();
    expect(screen.getByText("Текущий экран")).toBeInTheDocument();
  });
});
