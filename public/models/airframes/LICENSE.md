# Airframe meshes

`*.bin` files are derived from FlightGear aircraft models (volunteer-built, not manufacturer drawings) by
`scripts/build-fg-airframes.py`, and are distributed under the same GNU GPL licence as their source:

- `b739.bin`: https://github.com/FGMEMBERS/737-900ER (GPL-2.0), `Models/737-900.ac`
- `a320.bin`: https://github.com/FGMEMBERS/A320-family (GPL-2.0), fuselage, wings, winglets, stabilisers
- `b748.bin`: https://github.com/FGMEMBERS/747-8i (GPL-2.0), `Models/747-8F.ac`
- `b788.bin`: https://github.com/FGMEMBERS/787 (GPL-2.0), `Models/787-8.ac`
- `e170.bin`: https://github.com/FGMEMBERS/E-jet-family (GPL-2.0), `Models/erj170.ac`
- `e190.bin`: https://github.com/FGMEMBERS/E-jet-family (GPL-2.0), `Models/erj190.ac`

Source commits, triangle counts and SHA-256 hashes are in `lib/ga-live-markers/fg-airframes.json`.
The corresponding source is the upstream repositories above plus the conversion script.
