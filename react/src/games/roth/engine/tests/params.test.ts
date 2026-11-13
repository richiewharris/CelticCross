// The rules as numbers: each parameter resolves params > older rule field > default, and the layers and setting
// values act through it.
import { describe, expect, it } from "vitest";
import { DECKS } from "../cards";
import { DEFAULT_RULES, newMatch, type Rules } from "../engine";
import { param, PARAMS, resolveParams, settingOf } from "../params";

const R = (r: Partial<Rules>) => ({ ...DEFAULT_RULES, ...r }) as Rules;

describe("the parameter table", () => {
  it("resolves params, then the older rule field, then the default", () => {
    expect(param(R({}), "people.sluagh.dreams")).toBe(PARAMS["people.sluagh.dreams"]);
    expect(param(R({ dreams: 2 }), "people.sluagh.dreams")).toBe(2);
    expect(param(R({ dreams: 2, params: { "people.sluagh.dreams": 0 } }), "people.sluagh.dreams")).toBe(0);
    expect(param(R({ noAura: true }), "people.sluagh.aura")).toBe(0);
    expect(param(R({ merrow: "water+tide2" }), "people.merrow.tide")).toBe(2);
    expect(param(R({ merrow: "water+tideh" }), "people.merrow.tideHalf")).toBe(1);
    expect(param(R({ ulster: "light" }), "people.ulster.light")).toBe(2);
    expect(param(R({ settingBy: "none" }), "setting.choose")).toBe(0);
    expect(param({ ...DEFAULT_RULES, veiled: undefined } as Rules, "people.sidhe.veil")).toBe(0); // old saved positions
  });
  it("changes a setting's own numbers, and records a fixed setting's Valour", () => {
    const r = R({ setting: "crossing", params: { "setting.crossing.drain": 0, "setting.crossing.el.Water": 2 } });
    expect(settingOf(r)!.drain).toBe(0);
    expect(settingOf(r)!.el!.Water).toBe(2);
    expect(settingOf(R({ setting: "crossing" }))!.drain).toBe(1);
    expect(resolveParams(R({ setting: "crossing" }))["duel.fordValour"]).toBe(3);
    expect(() => settingOf(R({ setting: "ford", params: { "setting.ford.nonsense": 1 } }))).toThrow();
  });
  it("takes a switched-off layer out of both decks", () => {
    const S = newMatch([DECKS.ulster, DECKS.connacht], { params: { "layer.omen": 0, "layer.geis": 0 } }, 1);
    for (const P of S.players) expect(P.deckList.some((c) => c.type === "omen" || c.type === "geis")).toBe(false);
    const F = newMatch([DECKS.ulster, DECKS.connacht], {}, 1);
    expect(F.players[0].deckList.length).toBe(DECKS.ulster.length);
  });
});
