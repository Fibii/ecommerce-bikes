import { err, ok, type Result } from "./result";

export const FRAME_TYPES = [
  "Touring",
  "Road",
  "Mountain",
  "Urban",
  "E-Cargo",
  "E-Urban",
] as const;

/** The frame of a bike. It decides which accessories are compatible. */
export type FrameType = (typeof FRAME_TYPES)[number];

export type UnknownFrameType = {
  readonly code: "unknown-frame-type";
  readonly value: string;
};

export function frameType(value: string): Result<FrameType, UnknownFrameType> {
  const known = FRAME_TYPES.find((candidate) => candidate === value);
  return known === undefined
    ? err({ code: "unknown-frame-type", value })
    : ok(known);
}
