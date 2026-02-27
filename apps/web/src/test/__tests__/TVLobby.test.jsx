import { render, screen } from "@testing-library/react";
import TVLobby from "../../components/TV/TVLobby";
import { makeQuiz, makeTeam } from "../utils";

const quiz = makeQuiz();

describe("TVLobby", () => {
  it("renders without crash", () => {
    render(<TVLobby quiz={quiz} teams={[]} />);
  });

  it("shows QR code img element", () => {
    render(<TVLobby quiz={quiz} teams={[]} />);
    const img = screen.getByAltText("QR код бота");
    expect(img).toBeInTheDocument();
    expect(img.tagName).toBe("IMG");
  });

  it("QR code src contains bot username from env", () => {
    render(<TVLobby quiz={quiz} teams={[]} />);
    const img = screen.getByAltText("QR код бота");
    expect(img.src).toContain("testbot");
  });

  it("displays all team names", () => {
    const teams = [
      makeTeam({ id: 1, name: "Альфа" }),
      makeTeam({ id: 2, name: "Бета" }),
      makeTeam({ id: 3, name: "Гамма" }),
    ];
    render(<TVLobby quiz={quiz} teams={teams} />);
    expect(screen.getByText("Альфа")).toBeInTheDocument();
    expect(screen.getByText("Бета")).toBeInTheDocument();
    expect(screen.getByText("Гамма")).toBeInTheDocument();
  });

  it("shows team count", () => {
    const teams = [
      makeTeam({ id: 1, name: "Альфа" }),
      makeTeam({ id: 2, name: "Бета" }),
    ];
    render(<TVLobby quiz={quiz} teams={teams} />);
    expect(screen.getByText(/Зарегистрировано: 2/)).toBeInTheDocument();
  });

  it("does not crash with empty teams array", () => {
    render(<TVLobby quiz={quiz} teams={[]} />);
    expect(screen.queryByText(/Зарегистрировано/)).not.toBeInTheDocument();
  });

  it("does not render team list when teams is empty", () => {
    render(<TVLobby quiz={quiz} teams={[]} />);
    // No team-count header visible
    expect(screen.queryByText(/Зарегистрировано/)).not.toBeInTheDocument();
  });
});
