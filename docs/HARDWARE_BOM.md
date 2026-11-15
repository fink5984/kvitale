# Field-unit hardware: candidate BOM (options, not facts)

> **Everything in this document is a candidate to evaluate. Nothing here has been verified.**
> Model names come from public listings, and their specs vary by seller, revision and firmware.
> Don't order in volume until a sample of each part has passed the
> [verification checklist](#printer-verification-checklist) on the bench. When a unit passes,
> record the exact model, firmware and date in the "verified" column, and only then set
> the matching `*_verified` flags in the agent config.

Target enclosure: a column of roughly **24 × 24 × 100 cm** at a tzaddik's grave. A thermal printer
prints the slip; it is cut and falls through an internal chute into a closed receptacle.

---

## 1. Compute: Raspberry Pi options

| Option | Why consider it | Watch out for |
|---|---|---|
| **Pi Zero 2 W** | Small, low power, cheap. Enough for this agent, which is a single-threaded loop with stdlib Python. | Wi-Fi only (2.4 GHz), no Ethernet. A single micro-USB OTG port needs an OTG adapter or hub for a USB printer. Less headroom for a camera plus LTE. |
| **Pi 4 Model B (1–2 GB)** | Ethernet, USB-A ports (printer + LTE modem without a hub), dual-band Wi-Fi, can boot from USB SSD. | Uses more power and runs warmer. Needs a heatsink in a sun-exposed column. |
| Pi 3 B+ / Pi 5 | Fallbacks. Pi 3 B+ is between the two above; Pi 5 is more than needed and draws more power. | Check availability and power-supply requirements. |

Also needed: a high-endurance microSD card or a USB SSD, the official or a quality PSU sized for
the Pi, and an optional USB LTE modem or HAT for sites without Wi-Fi (the agent reports
`network: "lte"` for `wwan*`/`ppp*` interfaces).

## 2. Printer: 58 mm candidates (all UNVERIFIED)

| Candidate | Interface(s) to check | Notes | Verified? |
|---|---|---|---|
| **Cashino EP-261C** | USB / serial (TTL or RS-232) — confirm per variant | Panel-mount kiosk style. Listings often mention an auto-cutter; confirm on the sample. | ☐ UNVERIFIED |
| **Cashino EP-260C** | as above | A related variant. Differences from EP-261C (cutter, sensors, mounting) need checking. | ☐ UNVERIFIED |
| **SPRT SP-RME3** | USB / serial — confirm | Embedded kiosk class. Check whether paper near-end detection is present or optional. | ☐ UNVERIFIED |
| **SNR EP5803** | USB / serial — confirm | Embedded panel printer. Check the cutter option and the status protocol. | ☐ UNVERIFIED |

General notes:

- **Power:** kiosk thermal printers often need their own supply (commonly 12 V or 24 V, per the
  datasheet) with high peak current while printing dark areas. Don't power them from the Pi.
- **Interface:** prefer a USB printer class device, which shows up as `/dev/usb/lp0`. A USB-serial
  bridge or TTL serial also works through `connection = "serial"` (needs pyserial). Never enable
  XON/XOFF: the raster data contains 0x11/0x13 bytes.
- **Status:** many cheap printers are write-only over USB, so `DLE EOT` gets no reply. The agent
  then reports paper, cover and cutter as `unsupported` or `unknown`, which is honest but means
  the server can't detect paper-end before it happens.

### Printer verification checklist

Run this on a bench sample with `kvittel-agent test-print-local` and `diagnostics`. Use
`status_query = true` for the status rows. Record results per model and firmware.

| # | Check | How | Config it unlocks |
|---|---|---|---|
| 1 | **Raster (`GS v 0`) support** | Test pattern prints with straight borders and diagonals, no garbage characters, and no skew between 256-row bands. | `raster_verified` |
| 2 | **Geometry** | The 1 mm ticks match a ruler, and the pattern spans the full printable width. Confirms `width_dots` / `dots_per_mm`. | `width_dots`, `dots_per_mm` |
| 3 | **Band / buffer limits** | Print a tall page (~1 m). There should be no dropouts. If there are, lower `band_rows` / `write_chunk_bytes`. | `band_rows` |
| 4 | **Feed pitch** | `ESC d n` advances the expected distance. Measure it and set `line_feed_mm`. | `line_feed_mm` |
| 5 | **Full cut** | Find which bytes give a **full** cut, not a partial one. Try `1d5600` (GS V 0), `1d5601`, `1d564100`, `1d564200`, `1b69`, `1b6d`, and record which ones work. The slip must separate and fall freely. | `cut_command_hex`, `cut_verified` |
| 6 | **DLE EOT responds at all** | `diagnostics` → `printer.status.raw` is not `no_status_response`, and the fixed bits are valid. | `status_verified` (only together with 7–10) |
| 7 | **Paper-end** | Run the roll out. DLE EOT 4 (bits 5/6) or DLE EOT 2 (bit 5) reports paper end. | part of `status_verified` |
| 8 | **Near-end** | Near the end of a roll, DLE EOT 4 bits 2/3 change. Many models have no near-end sensor at all; record "absent" if so. | part of `status_verified` |
| 9 | **Cover-open** | Open the cover. DLE EOT 2 bit 2 changes. | part of `status_verified` |
| 10 | **Cut status** | With the cutter blocked (safely), DLE EOT 3 bit 3 reports a cutter error. If you can't induce it, cutter status stays unverified. | part of `status_verified` |
| 11 | **Real-time commands inside raster** | Some printers execute `DLE EOT`/`DLE ENQ` byte patterns that appear *inside* image data. Print a raster full of `10 04 xx` bytes and check for corruption. | informs whether status can be used at all |
| 12 | **Temperature** | Print quality and cutter reliability at the expected enclosure temperatures (in summer sun, a closed column can get far hotter than ambient). | — |
| 13 | **Roll size** | Maximum roll OD and core diameter the paper bay accepts (see §7). | — |

## 3. Chute sensor: optical options

The agent counts beam interruptions after it arms the sensor, just before the cut. It sends
`chute_detected` when it counts one drop per page within `chuteTimeoutMs`, and `chute_timeout`
otherwise. A break-beam proves *something passed*, not *which slip*. It is evidence, not proof.

| Option | Notes |
|---|---|
| **IR break-beam pair** (emitter + receiver, sold as 3 mm / 5 mm modules by several makers) | Simplest choice. Mount across the chute just below the cutter exit. Most receivers are open-collector: use a pull-up to **3.3 V** (`active_low = true`). |
| **Modulated IR sensor** (e.g. 38 kHz-type receiver) | More resistant to sunlight and ambient IR than an unmodulated beam. Needs a driver, or a module that includes one. |
| **Slot-type photo-interrupter** | Only works if the chute narrows to the interrupter's gap. Thin paper may not block enough light; test it. |
| **2-beam arrangement** | Two beams a few cm apart can tell a falling slip from a stuck one or a finger. This would need a code change; not implemented. |

Wiring cautions: **Pi GPIO is 3.3 V and not 5 V-tolerant.** Power the receiver from 3.3 V or level
shift its output. Use shielded or twisted cable for long runs, and fit the lenses so dust can be
wiped off during roll changes.

## 4. Power-loss detection: UPS HAT options

The agent currently ships `PowerMonitor` = **unsupported**. It never claims "AC failure"; the server
only reports power loss for units with `capabilities.power = "supported"`. Supporting a UPS
requires a small adapter.

| Option (candidates) | What to check |
|---|---|
| Waveshare UPS HAT family | Whether it has an I²C fuel gauge or current monitor, and an "external power present" signal. |
| PiSugar (Zero form factor) | Whether there is an API/I²C register for charger input presence, plus its battery capacity. |
| Geekworm X-series UPS | The GPIO pin used for AC-loss, and battery chemistry/temperature limits outdoors. |
| PiJuice-style HATs | Availability, and its I²C interface. |

Design questions to settle before choosing:

1. Does the UPS keep **only the Pi** running, or the printer too? The recommended behaviour is to
   stop leasing on battery, finish nothing new, and report `power_lost`.
2. Whether the battery chemistry and charging are safe at enclosure temperatures.
3. That the unit can shut down cleanly before the battery is empty, so the journal is safe either
   way because it is fsync'd.

## 5. Optional camera

- Purpose: evidence that a slip went through the slot. The agent has **no camera code** and reports
  `camera: "not_installed"`.
- **Point it only at the slot exit or receptacle opening. Never at people, the grave area or
  visitors.** No audio. Mask the field of view physically, not only in software.
- Candidate: a Pi Camera Module (CSI), or a small USB camera if CSI isn't available on the chosen
  Pi.
- Before deploying, check privacy and local law, and get the site authority's consent.

## 6. Enclosure, lock, chute

- **Column ~24 × 24 × 100 cm**. Candidate materials: powder-coated or stainless steel, or HPL
  panels on a frame. Use a light colour and/or a sunshade to reduce solar heat load. Fit
  ventilation with a breathable membrane vent against condensation. Target roughly IP54-class
  protection from rain and dust; the exact rating needs an assessment.
- **Lock:** a high-security cam lock or a restricted-key system. Consider a tamper switch on the
  door (a future GPIO input; not implemented).
- **Chute:**
  - The slot must be wider than the paper with margin (58 mm paper → roughly 70 mm or more).
  - Make the surfaces smooth and steep (≥ 60° suggested) so curled thermal paper doesn't stick.
    Consider anti-static treatment.
  - Fit an **anti-retrieval baffle** so slips can't be fished back out.
  - Add a drain path for water.
  - Mount the sensor right below the cutter exit.
- **Electrical:** a licensed electrician handles the mains feed, RCD/GFCI and surge protection.
  Keep the printer PSU and the Pi PSU separate. Use strain relief on every cable.
- **Site:** the unit stands at a holy site. Keep the appearance discreet and respectful, and agree
  on placement with the site's authorities. Shabbat/Yom Tov blackout is enforced by the server
  before leasing, not by the device.

## 7. Consumables

- **Thermal paper roll, e.g. 58 mm wide × 40 mm outer diameter × 12 mm core.** Check this against
  the chosen printer's maximum roll OD and core size, since some bays take larger rolls.
- Rough estimate (not a spec): a 40 mm OD roll on a 12 mm core with ~55–60 µm paper holds about
  **18–20 m**. At ~113 mm per slip plus ~12 mm feed, that is on the order of **~150 slips per
  roll**. Measure on real rolls, then set the roll-change interval.
- Prefer **phenol-free (BPA/BPS-free)**, top-coated thermal paper for longer image life. Store
  spare rolls cool, dry and dark. Thermal paper darkens with heat, which matters for spare rolls
  stored in the column.
- Spares per site: rolls, one spare chute-sensor pair, a microSD card with the image pre-flashed
  (not paired), and fuses if the PSU design uses them.
