# Runtime logical load groups

The classic script tags remain intentionally unbundled. Their logical ownership is:

1. boot/save/economy/accounting (`runtime`, `data`, `finance`, `engine`, save storage)
2. ramen/market/supply/workforce/report (`market`, `supply`, `workforce`, weekly reporting)
3. initial personal/company listed-stock investing (`engine` and market UI)
4. office-gated VC/capital policy/M&A/subsidiary (`ma-*`, startup and capital-allocation modules)
5. multi-store/brand/HQ/vertical integration/IPO (`expansion`, office and listing modules)

Keep dependency order explicit in `index.html` and `play.html`; new functionality should extend these groups rather than introduce a second simulation or a bundle.
