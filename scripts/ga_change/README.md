# Georgia satellite change snapshot

`method.summary`:

> Anniversary-date NDVI/NBR differencing on cloud-masked Sentinel-2 L2A, H3 res-8 medians, robust z (median/MAD) per MGRS tile; flagged at |z|>=3.5 with >=1 same-sign neighbour or |z|>=6. Confirmed when a second independent date pair agrees (|z|>=3) and the Prithvi-EO-2.0 embedding distance is >=2 robust z above random control cells. Not validated against labelled change benchmarks.

This is a manually regenerated snapshot. From the repository root:

```sh
mkdir -p ~/.venvs
python -m venv ~/.venvs/ga-change
source ~/.venvs/ga-change/bin/activate
pip install -r scripts/ga_change/requirements.txt
python scripts/ga_change/detect.py
```

The default output is `public/geo/ga-change.json`.
