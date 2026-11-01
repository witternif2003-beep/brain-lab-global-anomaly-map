# Airframe meshes

`*.bin` files are derived from FlightGear aircraft models (volunteer-built, not manufacturer drawings) by
`scripts/build-fg-airframes.py`, and are distributed under the same GNU GPL licence as their source:

- `b739.bin`: https://github.com/FGMEMBERS/737-900ER (GPL-2.0), `Models/737-900.ac`
- `a320.bin`: https://github.com/FGMEMBERS/A320-family (GPL-2.0), fuselage, wings, winglets, stabilisers

Source commits, triangle counts and SHA-256 hashes are in `lib/ga-live-markers/fg-airframes.json`.
The corresponding source is the upstream repositories above plus the conversion script.
