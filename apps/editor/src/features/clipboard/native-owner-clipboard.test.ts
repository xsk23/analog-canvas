import { describe, expect, it } from "vitest";
import {
  CircuitProjectSchema,
  ComponentDefinitionSchema,
  createEmptyProject,
} from "@icm/model";
import {
  encodeCircuitClipboard,
  decodeCircuitClipboard,
} from "./system-clipboard";
import {
  applyProjectCopyPlacement,
  planProjectCopyPlacement,
} from "./project-copy";

describe("clipboard native circuit ownership", () => {
  it.each([
    {
      name: "whole Cell with unused native artwork",
      placed: false,
      selected: false,
    },
    {
      name: "partial selection excluding native artwork",
      placed: true,
      selected: false,
    },
    {
      name: "whole Cell including native artwork",
      placed: true,
      selected: true,
    },
  ])("copies $name", ({ placed, selected }) => {
    const source = createEmptyProject("source", "Source");
    const document = source.documents[0]!;
    document.instances.push({
      id: "R1",
      reference: "R1",
      symbolId: "resistor",
      placement: { position: { x: 0, y: 0 }, rotation: 0, mirror: "none" },
      netlist: { parameters: { r: "1k" } },
    });
    source.externalSubcircuitDefinitions.push({
      id: "native",
      name: "native",
      symbolId: "native-artwork",
      terminals: [{ id: "native-a", name: "A", direction: "passive" }],
      formalParameters: [],
      interfaceStatus: "declared",
    });
    source.componentDefinitions = [
      ComponentDefinitionSchema.parse({
        symbol: {
          schemaVersion: 1,
          id: "native-artwork",
          name: "Native",
          viewBox: { x: -40, y: -40, width: 80, height: 80 },
          variants: [],
          primitives: [{ kind: "circle", center: { x: 0, y: 0 }, radius: 20 }],
          pins: [
            {
              name: "A",
              role: "passive",
              at: { x: -40, y: 0 },
              direction: "west",
              presentation: { visibility: "visible" },
            },
          ],
        },
        circuitBinding: {
          definitionId: "native",
          terminals: [{ terminalId: "native-a", pinName: "A" }],
        },
      }),
    ];
    if (placed)
      document.instances.push({
        id: "X1",
        reference: "X1",
        symbolId: "native-artwork",
        placement: { position: { x: 400, y: 0 }, rotation: 0, mirror: "none" },
        netlist: {
          binding: { kind: "external-subcircuit", definitionId: "native" },
          parameters: {},
        },
      });
    expect(CircuitProjectSchema.safeParse(source).success).toBe(true);
    const before = structuredClone(source);
    const encoded = encodeCircuitClipboard(source, document, {
      instanceIds: selected ? ["R1", "X1"] : ["R1"],
      routeIds: [],
      junctionIds: [],
      annotationIds: [],
      draftingIds: [],
    })!;
    const clipboard = decodeCircuitClipboard(encoded)!;
    const target = createEmptyProject("target", "Target");
    const pasted = applyProjectCopyPlacement(
      planProjectCopyPlacement(
        target,
        target.documents[0]!,
        clipboard,
        { x: 200, y: 0 },
        1,
      ),
    );
    expect(pasted.documents[0]!.instances).toHaveLength(selected ? 2 : 1);
    expect(pasted.documents[0]!.instances[0]!.symbolId).toBe("resistor");
    expect(pasted.externalSubcircuitDefinitions).toHaveLength(selected ? 1 : 0);
    if (selected) {
      const native = pasted.documents[0]!.instances[1]!;
      const artwork = pasted.componentDefinitions!.find(
        (item) => item.symbol.id === native.symbolId,
      )!;
      expect(artwork.circuitBinding!.definitionId).toBe(
        pasted.externalSubcircuitDefinitions[0]!.id,
      );
      expect(native.netlist!.binding).toEqual({
        kind: "external-subcircuit",
        definitionId: artwork.circuitBinding!.definitionId,
      });
    }
    expect(CircuitProjectSchema.safeParse(pasted).success).toBe(true);
    expect(source).toEqual(before);
  });
});
