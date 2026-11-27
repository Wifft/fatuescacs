import { describe, expect, it } from "vitest";
import { describePosition, parsePieceCode } from "@/lib/chess/describe";
import { pieceLabel, positionText } from "@/messages/es";

describe("position description", () => {
  it("lists pieces per side in a fixed order with Spanish names", () => {
    const text = positionText(
      describePosition("rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1"),
    );
    expect(text).toMatch(
      /^Blancas: Rey en e1; Dama en d1; Torres en a1 y h1; Alfiles en c1 y f1; Caballos en b1 y g1; Peones en a2, b2, c2, d2, e4, f2, g2 y h2\./,
    );
    expect(text).toContain("Negras: Rey en e8;");
    expect(text.endsWith("Juegan negras.")).toBe(true);
  });
  it("reports check, mate and stalemate", () => {
    expect(positionText(describePosition("4k3/8/8/8/8/8/8/4R1K1 b - - 0 1"))).toContain(
      "Juegan negras, en jaque.",
    );
    expect(
      positionText(
        describePosition("rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3"),
      ),
    ).toContain("Jaque mate: ganan negras.");
    expect(positionText(describePosition("7k/5Q2/6K1/8/8/8/8/8 b - - 0 1"))).toContain(
      "Rey ahogado: tablas.",
    );
  });
  it("names pieces with gender agreement", () => {
    expect(pieceLabel("n", "b", "f6")).toBe("Caballo negro en f6");
    expect(pieceLabel("q", "w", "d1")).toBe("Dama blanca en d1");
    expect(pieceLabel("r", "b", "a8")).toBe("Torre negra en a8");
  });
  it("parses react-chessboard piece codes", () => {
    expect(parsePieceCode("wN")).toEqual({ color: "w", type: "n" });
    expect(parsePieceCode("bK")).toEqual({ color: "b", type: "k" });
    expect(parsePieceCode("xx")).toBeNull();
  });
});
