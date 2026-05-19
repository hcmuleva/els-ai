export type WorksheetModel = {
  id: string;
  title: string;
  color: string;
  frontHtml: string;
  backHtml: string;
};

export const worksheetModels: WorksheetModel[] = [
  {
    id: 'ws_s301_set02_animal_homes',
    title: 'Set02 Animal Homes',
    color: '#f59e0b',
    frontHtml: `<!doctype html>
<html lang="en">

<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>WS_S301_SET02_ANIMAL_HOMES Front</title>
  <style>
    :root {
      --w: 794px;
      --h: 1123px;
      --line: #666;
      --head-bg: #d8efcb;
      --head-border: #80aa75;
      --panel-bg: #f8f8f4;
    }

    * {
      box-sizing: border-box;
    }

    body {
      margin: 0;
      padding: 18px;
      background: #ecefe8;
      font-family: "Trebuchet MS", Verdana, sans-serif;
    }

    .sheet {
      width: var(--w);
      height: var(--h);
      margin: 0 auto;
      background: #fff;
      border: 1.4px solid var(--line);
      position: relative;
    }

    .header {
      margin: 10px;
      border: 1px solid var(--head-border);
      background: var(--head-bg);
      padding: 10px 12px;
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 10px;
      align-items: center;
    }

    .title {
      font-size: 15px;
      font-weight: 700;
    }

    .meta {
      font-size: 12px;
      color: #333;
      margin-top: 2px;
    }

    .badge {
      width: 36px;
      height: 36px;
      border-radius: 50%;
      border: 1px solid var(--line);
      display: grid;
      place-items: center;
      font-weight: 700;
      background: #f3f3f3;
    }

    .board {
      margin: 0 10px 10px;
      height: calc(100% - 92px);
      display: grid;
      grid-template-columns: 1fr 220px;
      gap: 10px;
    }

    .left {
      border: 1px solid var(--line);
      background: #fff;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
      padding: 10px;
      align-content: start;
    }

    .card {
      border: 1px dashed #bbb;
      border-radius: 6px;
      padding: 8px;
      display: grid;
      grid-template-columns: 44px 1fr auto;
      gap: 8px;
      align-items: center;
      min-height: 88px;
    }

    .icon {
      font-size: 30px;
      text-align: center;
    }

    .txt {
      font-size: 14px;
      font-weight: 700;
    }

    .slot {
      font-size: 12px;
      color: #333;
      margin-top: 4px;
    }

    .slot-btn img {
      width: 28px;
      height: 28px;
      display: block;
    }

    .right {
      border: 1px solid var(--line);
      background: var(--panel-bg);
      display: grid;
      grid-template-rows: repeat(10, 1fr);
    }

    .opt {
      border-bottom: 1px solid var(--line);
      padding: 6px;
      display: grid;
      grid-template-columns: 36px 1fr;
      gap: 6px;
      align-items: center;
      font-size: 13px;
    }

    .opt:last-child {
      border-bottom: 0;
    }

    .oid {
      font-weight: 700;
      text-align: center;
    }

    @media print {
      body {
        background: #fff;
        padding: 0;
      }

      .sheet {
        border: 1px solid #444;
      }
    }
  </style>
</head>

<body>
  <article class="sheet">
    <header class="header">
      <div>
        <div class="title">Match each animal with its correct home.</div>
        <div class="meta">Worksheet ID: WS_S301_SET02_ANIMAL_HOMES | Structure: LP_FIXED_V1 | Side: Front</div>
      </div>
      <div class="badge">2</div>
    </header>

    <section class="board">
      <div class="left">
        <div class="card">
          <div class="icon">🦁</div>
          <div>
            <div class="txt">Lion</div>
            <div class="slot">Slot S4</div>
          </div>
          <div class="slot-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Yellow%20button%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%23F1C40F%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S4" /></div>
        </div>
        <div class="card">
          <div class="icon">🐶</div>
          <div>
            <div class="txt">Dog</div>
            <div class="slot">Slot S1</div>
          </div>
          <div class="slot-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Red%20button%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%23E74C3C%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S1" /></div>
        </div>
        <div class="card">
          <div class="icon">🐦</div>
          <div>
            <div class="txt">Bird</div>
            <div class="slot">Slot S7</div>
          </div>
          <div class="slot-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Green%20button%20with%20white%20center%20circle%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%232ECC71%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2211%22%20fill%3D%22%23FFFFFF%22%20stroke%3D%22%23999%22%20stroke-width%3D%221.2%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S7" /></div>
        </div>
        <div class="card">
          <div class="icon">🐟</div>
          <div>
            <div class="txt">Fish</div>
            <div class="slot">Slot S10</div>
          </div>
          <div class="slot-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Orange%20button%20with%20white%20center%20circle%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%23E67E22%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2211%22%20fill%3D%22%23FFFFFF%22%20stroke%3D%22%23999%22%20stroke-width%3D%221.2%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S10" /></div>
        </div>
        <div class="card">
          <div class="icon">🐝</div>
          <div>
            <div class="txt">Bee</div>
            <div class="slot">Slot S2</div>
          </div>
          <div class="slot-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Green%20button%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%232ECC71%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S2" /></div>
        </div>
        <div class="card">
          <div class="icon">🐔</div>
          <div>
            <div class="txt">Hen</div>
            <div class="slot">Slot S9</div>
          </div>
          <div class="slot-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Yellow%20button%20with%20white%20center%20circle%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%23F1C40F%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2211%22%20fill%3D%22%23FFFFFF%22%20stroke%3D%22%23999%22%20stroke-width%3D%221.2%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S9" /></div>
        </div>
        <div class="card">
          <div class="icon">🐇</div>
          <div>
            <div class="txt">Rabbit</div>
            <div class="slot">Slot S5</div>
          </div>
          <div class="slot-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Orange%20button%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%23E67E22%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S5" /></div>
        </div>
        <div class="card">
          <div class="icon">🐴</div>
          <div>
            <div class="txt">Horse</div>
            <div class="slot">Slot S3</div>
          </div>
          <div class="slot-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Blue%20button%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%233498DB%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S3" /></div>
        </div>
        <div class="card">
          <div class="icon">🕷️</div>
          <div>
            <div class="txt">Spider</div>
            <div class="slot">Slot S8</div>
          </div>
          <div class="slot-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Blue%20button%20with%20white%20center%20circle%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%233498DB%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2211%22%20fill%3D%22%23FFFFFF%22%20stroke%3D%22%23999%22%20stroke-width%3D%221.2%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S8" /></div>
        </div>
        <div class="card">
          <div class="icon">🐄</div>
          <div>
            <div class="txt">Cow</div>
            <div class="slot">Slot S6</div>
          </div>
          <div class="slot-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Red%20button%20with%20white%20center%20circle%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%23E74C3C%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2211%22%20fill%3D%22%23FFFFFF%22%20stroke%3D%22%23999%22%20stroke-width%3D%221.2%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S6" /></div>
        </div>
      </div>

      <aside class="right">
        <div class="opt">
          <div class="oid">R1</div>
          <div>Kennel</div>
        </div>
        <div class="opt">
          <div class="oid">R2</div>
          <div>Hive</div>
        </div>
        <div class="opt">
          <div class="oid">R3</div>
          <div>Stable</div>
        </div>
        <div class="opt">
          <div class="oid">R4</div>
          <div>Den</div>
        </div>
        <div class="opt">
          <div class="oid">R5</div>
          <div>Burrow</div>
        </div>
        <div class="opt">
          <div class="oid">R6</div>
          <div>Shed</div>
        </div>
        <div class="opt">
          <div class="oid">R7</div>
          <div>Nest</div>
        </div>
        <div class="opt">
          <div class="oid">R8</div>
          <div>Web</div>
        </div>
        <div class="opt">
          <div class="oid">R9</div>
          <div>Coop</div>
        </div>
        <div class="opt">
          <div class="oid">R10</div>
          <div>Pond</div>
        </div>
      </aside>
    </section>

  </article>
</body>

</html>`,
    backHtml: `<!doctype html>
<html lang="en">

<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>WS_S301_SET02_ANIMAL_HOMES Flip</title>
  <style>
    :root {
      --w: 794px;
      --h: 1123px;
      --line: #666;
      --head-bg: #feeec9;
      --head-border: #b28d44;
      --panel-bg: #faf7ef;
    }

    * {
      box-sizing: border-box;
    }

    body {
      margin: 0;
      padding: 18px;
      background: #ecefe8;
      font-family: "Trebuchet MS", Verdana, sans-serif;
    }

    .sheet {
      width: var(--w);
      height: var(--h);
      margin: 0 auto;
      background: #fff;
      border: 1.4px solid var(--line);
      position: relative;
    }

    .header {
      margin: 10px;
      border: 1px solid var(--head-border);
      background: var(--head-bg);
      padding: 10px 12px;
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 10px;
      align-items: center;
    }

    .title {
      font-size: 15px;
      font-weight: 700;
    }

    .meta {
      font-size: 12px;
      color: #333;
      margin-top: 2px;
    }

    .badge {
      width: 36px;
      height: 36px;
      border-radius: 50%;
      border: 1px solid var(--line);
      display: grid;
      place-items: center;
      font-weight: 700;
      background: #f3f3f3;
    }

    .board {
      margin: 0 10px 10px;
      height: calc(100% - 92px);
      display: grid;
      grid-template-columns: 1fr 220px;
      gap: 10px;
    }

    .left {
      border: 1px solid var(--line);
      background: #fff;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
      padding: 10px;
      align-content: start;
    }

    .card {
      border: 1px dashed #bbb;
      border-radius: 6px;
      padding: 8px;
      display: grid;
      grid-template-columns: 44px 1fr auto;
      gap: 8px;
      align-items: center;
      min-height: 88px;
    }

    .icon {
      font-size: 30px;
      text-align: center;
    }

    .txt {
      font-size: 14px;
      font-weight: 700;
    }

    .slot {
      font-size: 12px;
      color: #333;
      margin-top: 4px;
    }

    .slot-btn img {
      width: 28px;
      height: 28px;
      display: block;
    }

    .right {
      border: 1px solid var(--line);
      background: var(--panel-bg);
      display: grid;
      grid-template-rows: repeat(10, 1fr);
    }

    .opt {
      border-bottom: 1px solid var(--line);
      padding: 6px;
      display: grid;
      grid-template-columns: 34px 1fr auto;
      gap: 6px;
      align-items: center;
      font-size: 13px;
    }

    .opt:last-child {
      border-bottom: 0;
    }

    .oid {
      font-weight: 700;
      text-align: center;
    }

    .ans-btn img {
      width: 24px;
      height: 24px;
      display: block;
    }

    @media print {
      body {
        background: #fff;
        padding: 0;
      }

      .sheet {
        border: 1px solid #444;
      }
    }
  </style>
</head>

<body>
  <article class="sheet">
    <header class="header">
      <div>
        <div class="title">Answer Side: Match your front attempt with the correct button next to each option.</div>
        <div class="meta">Worksheet ID: WS_S301_SET02_ANIMAL_HOMES | Structure: LP_FIXED_V1 | Side: Flip</div>
      </div>
      <div class="badge">2</div>
    </header>

    <section class="board">
      <div class="left">
        <div class="card">
          <div class="icon">🦁</div>
          <div>
            <div class="txt">Lion</div>
            <div class="slot">Slot S4</div>
          </div>
          <div class="slot-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Yellow%20button%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%23F1C40F%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S4" /></div>
        </div>
        <div class="card">
          <div class="icon">🐶</div>
          <div>
            <div class="txt">Dog</div>
            <div class="slot">Slot S1</div>
          </div>
          <div class="slot-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Red%20button%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%23E74C3C%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S1" /></div>
        </div>
        <div class="card">
          <div class="icon">🐦</div>
          <div>
            <div class="txt">Bird</div>
            <div class="slot">Slot S7</div>
          </div>
          <div class="slot-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Green%20button%20with%20white%20center%20circle%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%232ECC71%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2211%22%20fill%3D%22%23FFFFFF%22%20stroke%3D%22%23999%22%20stroke-width%3D%221.2%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S7" /></div>
        </div>
        <div class="card">
          <div class="icon">🐟</div>
          <div>
            <div class="txt">Fish</div>
            <div class="slot">Slot S10</div>
          </div>
          <div class="slot-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Orange%20button%20with%20white%20center%20circle%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%23E67E22%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2211%22%20fill%3D%22%23FFFFFF%22%20stroke%3D%22%23999%22%20stroke-width%3D%221.2%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S10" /></div>
        </div>
        <div class="card">
          <div class="icon">🐝</div>
          <div>
            <div class="txt">Bee</div>
            <div class="slot">Slot S2</div>
          </div>
          <div class="slot-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Green%20button%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%232ECC71%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S2" /></div>
        </div>
        <div class="card">
          <div class="icon">🐔</div>
          <div>
            <div class="txt">Hen</div>
            <div class="slot">Slot S9</div>
          </div>
          <div class="slot-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Yellow%20button%20with%20white%20center%20circle%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%23F1C40F%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2211%22%20fill%3D%22%23FFFFFF%22%20stroke%3D%22%23999%22%20stroke-width%3D%221.2%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S9" /></div>
        </div>
        <div class="card">
          <div class="icon">🐇</div>
          <div>
            <div class="txt">Rabbit</div>
            <div class="slot">Slot S5</div>
          </div>
          <div class="slot-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Orange%20button%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%23E67E22%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S5" /></div>
        </div>
        <div class="card">
          <div class="icon">🐴</div>
          <div>
            <div class="txt">Horse</div>
            <div class="slot">Slot S3</div>
          </div>
          <div class="slot-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Blue%20button%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%233498DB%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S3" /></div>
        </div>
        <div class="card">
          <div class="icon">🕷️</div>
          <div>
            <div class="txt">Spider</div>
            <div class="slot">Slot S8</div>
          </div>
          <div class="slot-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Blue%20button%20with%20white%20center%20circle%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%233498DB%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2211%22%20fill%3D%22%23FFFFFF%22%20stroke%3D%22%23999%22%20stroke-width%3D%221.2%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S8" /></div>
        </div>
        <div class="card">
          <div class="icon">🐄</div>
          <div>
            <div class="txt">Cow</div>
            <div class="slot">Slot S6</div>
          </div>
          <div class="slot-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Red%20button%20with%20white%20center%20circle%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%23E74C3C%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2211%22%20fill%3D%22%23FFFFFF%22%20stroke%3D%22%23999%22%20stroke-width%3D%221.2%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S6" /></div>
        </div>
      </div>

      <aside class="right">
        <div class="opt">
          <div class="oid">R1</div>
          <div>Kennel</div>
          <div class="ans-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Red%20button%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%23E74C3C%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S1" /></div>
        </div>
        <div class="opt">
          <div class="oid">R2</div>
          <div>Hive</div>
          <div class="ans-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Green%20button%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%232ECC71%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S2" /></div>
        </div>
        <div class="opt">
          <div class="oid">R3</div>
          <div>Stable</div>
          <div class="ans-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Blue%20button%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%233498DB%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S3" /></div>
        </div>
        <div class="opt">
          <div class="oid">R4</div>
          <div>Den</div>
          <div class="ans-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Yellow%20button%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%23F1C40F%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S4" /></div>
        </div>
        <div class="opt">
          <div class="oid">R5</div>
          <div>Burrow</div>
          <div class="ans-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Orange%20button%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%23E67E22%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S5" /></div>
        </div>
        <div class="opt">
          <div class="oid">R6</div>
          <div>Shed</div>
          <div class="ans-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Red%20button%20with%20white%20center%20circle%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%23E74C3C%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2211%22%20fill%3D%22%23FFFFFF%22%20stroke%3D%22%23999%22%20stroke-width%3D%221.2%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S6" /></div>
        </div>
        <div class="opt">
          <div class="oid">R7</div>
          <div>Nest</div>
          <div class="ans-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Green%20button%20with%20white%20center%20circle%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%232ECC71%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2211%22%20fill%3D%22%23FFFFFF%22%20stroke%3D%22%23999%22%20stroke-width%3D%221.2%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S7" /></div>
        </div>
        <div class="opt">
          <div class="oid">R8</div>
          <div>Web</div>
          <div class="ans-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Blue%20button%20with%20white%20center%20circle%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%233498DB%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2211%22%20fill%3D%22%23FFFFFF%22%20stroke%3D%22%23999%22%20stroke-width%3D%221.2%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S8" /></div>
        </div>
        <div class="opt">
          <div class="oid">R9</div>
          <div>Coop</div>
          <div class="ans-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Yellow%20button%20with%20white%20center%20circle%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%23F1C40F%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2211%22%20fill%3D%22%23FFFFFF%22%20stroke%3D%22%23999%22%20stroke-width%3D%221.2%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S9" /></div>
        </div>
        <div class="opt">
          <div class="oid">R10</div>
          <div>Pond</div>
          <div class="ans-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Orange%20button%20with%20white%20center%20circle%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%23E67E22%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2211%22%20fill%3D%22%23FFFFFF%22%20stroke%3D%22%23999%22%20stroke-width%3D%221.2%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S10" /></div>
        </div>
      </aside>
    </section>

  </article>
</body>

</html>`,
  },
  {
    id: 'ws_s301_set03_baby_animals',
    title: 'Set03 Baby Animals',
    color: '#2563eb',
    frontHtml: `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>WS_S301_SET03_BABY_ANIMALS Front</title>
  <style>
    :root { --w: 794px; --h: 1123px; --line: #666; --head-bg: #d8efcb; --head-border: #80aa75; --panel-bg: #f8f8f4; }
    * { box-sizing: border-box; }
    body { margin: 0; padding: 18px; background: #ecefe8; font-family: "Trebuchet MS", Verdana, sans-serif; }
    .sheet { width: var(--w); height: var(--h); margin: 0 auto; background: #fff; border: 1.4px solid var(--line); position: relative; }
    .header { margin: 10px; border: 1px solid var(--head-border); background: var(--head-bg); padding: 10px 12px; display: grid; grid-template-columns: 1fr auto; gap: 10px; align-items: center; }
    .title { font-size: 15px; font-weight: 700; }
    .meta { font-size: 12px; color: #333; margin-top: 2px; }
    .badge { width: 36px; height: 36px; border-radius: 50%; border: 1px solid var(--line); display: grid; place-items: center; font-weight: 700; background: #f3f3f3; }
    .board { margin: 0 10px 10px; height: calc(100% - 92px); display: grid; grid-template-columns: 1fr 220px; gap: 10px; }
    .left { border: 1px solid var(--line); background: #fff; display: grid; grid-template-columns: 1fr 1fr; gap: 8px; padding: 10px; align-content: start; }
    .card { border: 1px dashed #bbb; border-radius: 6px; padding: 8px; display: grid; grid-template-columns: 44px 1fr auto; gap: 8px; align-items: center; min-height: 88px; }
    .icon { font-size: 30px; text-align: center; }
    .txt { font-size: 14px; font-weight: 700; }
    .slot { font-size: 12px; color: #333; margin-top: 4px; }
    .slot-btn img { width: 28px; height: 28px; display: block; }
    .right { border: 1px solid var(--line); background: var(--panel-bg); display: grid; grid-template-rows: repeat(10, 1fr); }
    .opt { border-bottom: 1px solid var(--line); padding: 6px; display: grid; grid-template-columns: 36px 1fr; gap: 6px; align-items: center; font-size: 13px; }
    .opt:last-child { border-bottom: 0; }
    .oid { font-weight: 700; text-align: center; }
    @media print { body { background: #fff; padding: 0; } .sheet { border: 1px solid #444; } }
  </style>
</head>
<body>
  <article class="sheet">
    <header class="header">
      <div>
        <div class="title">Match each animal with its baby name.</div>
        <div class="meta">Worksheet ID: WS_S301_SET03_BABY_ANIMALS | Structure: LP_FIXED_V1 | Side: Front</div>
      </div>
      <div class="badge">3</div>
    </header>
    <section class="board">
      <div class="left">
        <div class="card"><div class="icon">🦁</div><div><div class="txt">Lion</div><div class="slot">Slot S6</div></div><div class="slot-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Red%20button%20with%20white%20center%20circle%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%23E74C3C%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2211%22%20fill%3D%22%23FFFFFF%22%20stroke%3D%22%23999%22%20stroke-width%3D%221.2%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S6" /></div></div>
        <div class="card"><div class="icon">🐱</div><div><div class="txt">Cat</div><div class="slot">Slot S2</div></div><div class="slot-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Green%20button%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%232ECC71%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S2" /></div></div>
        <div class="card"><div class="icon">🐑</div><div><div class="txt">Sheep</div><div class="slot">Slot S9</div></div><div class="slot-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Yellow%20button%20with%20white%20center%20circle%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%23F1C40F%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2211%22%20fill%3D%22%23FFFFFF%22%20stroke%3D%22%23999%22%20stroke-width%3D%221.2%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S9" /></div></div>
        <div class="card"><div class="icon">🐶</div><div><div class="txt">Dog</div><div class="slot">Slot S1</div></div><div class="slot-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Red%20button%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%23E74C3C%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S1" /></div></div>
        <div class="card"><div class="icon">🐴</div><div><div class="txt">Horse</div><div class="slot">Slot S4</div></div><div class="slot-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Yellow%20button%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%23F1C40F%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S4" /></div></div>
        <div class="card"><div class="icon">🐸</div><div><div class="txt">Frog</div><div class="slot">Slot S8</div></div><div class="slot-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Blue%20button%20with%20white%20center%20circle%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%233498DB%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2211%22%20fill%3D%22%23FFFFFF%22%20stroke%3D%22%23999%22%20stroke-width%3D%221.2%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S8" /></div></div>
        <div class="card"><div class="icon">🦌</div><div><div class="txt">Deer</div><div class="slot">Slot S10</div></div><div class="slot-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Orange%20button%20with%20white%20center%20circle%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%23E67E22%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2211%22%20fill%3D%22%23FFFFFF%22%20stroke%3D%22%23999%22%20stroke-width%3D%221.2%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S10" /></div></div>
        <div class="card"><div class="icon">🐄</div><div><div class="txt">Cow</div><div class="slot">Slot S3</div></div><div class="slot-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Blue%20button%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%233498DB%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S3" /></div></div>
        <div class="card"><div class="icon">🐐</div><div><div class="txt">Goat</div><div class="slot">Slot S5</div></div><div class="slot-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Orange%20button%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%23E67E22%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S5" /></div></div>
        <div class="card"><div class="icon">🐔</div><div><div class="txt">Hen</div><div class="slot">Slot S7</div></div><div class="slot-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Green%20button%20with%20white%20center%20circle%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%232ECC71%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2211%22%20fill%3D%22%23FFFFFF%22%20stroke%3D%22%23999%22%20stroke-width%3D%221.2%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S7" /></div></div>
      </div>
      <aside class="right">
        <div class="opt"><div class="oid">R4</div><div>Foal</div></div>
        <div class="opt"><div class="oid">R10</div><div>Fawn</div></div>
        <div class="opt"><div class="oid">R2</div><div>Kitten</div></div>
        <div class="opt"><div class="oid">R8</div><div>Tadpole</div></div>
        <div class="opt"><div class="oid">R6</div><div>Cub</div></div>
        <div class="opt"><div class="oid">R1</div><div>Puppy</div></div>
        <div class="opt"><div class="oid">R9</div><div>Lamb</div></div>
        <div class="opt"><div class="oid">R5</div><div>Kid</div></div>
        <div class="opt"><div class="oid">R3</div><div>Calf</div></div>
        <div class="opt"><div class="oid">R7</div><div>Chick</div></div>
      </aside>
    </section>
  </article>
</body>
</html>
`,
    backHtml: `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>WS_S301_SET03_BABY_ANIMALS Flip</title>
  <style>
    :root { --w: 794px; --h: 1123px; --line: #666; --head-bg: #feeec9; --head-border: #b28d44; --panel-bg: #faf7ef; }
    * { box-sizing: border-box; }
    body { margin: 0; padding: 18px; background: #ecefe8; font-family: "Trebuchet MS", Verdana, sans-serif; }
    .sheet { width: var(--w); height: var(--h); margin: 0 auto; background: #fff; border: 1.4px solid var(--line); position: relative; }
    .header { margin: 10px; border: 1px solid var(--head-border); background: var(--head-bg); padding: 10px 12px; display: grid; grid-template-columns: 1fr auto; gap: 10px; align-items: center; }
    .title { font-size: 15px; font-weight: 700; }
    .meta { font-size: 12px; color: #333; margin-top: 2px; }
    .badge { width: 36px; height: 36px; border-radius: 50%; border: 1px solid var(--line); display: grid; place-items: center; font-weight: 700; background: #f3f3f3; }
    .board { margin: 0 10px 10px; height: calc(100% - 92px); display: grid; grid-template-columns: 1fr 220px; gap: 10px; }
    .left { border: 1px solid var(--line); background: #fff; display: grid; grid-template-columns: 1fr 1fr; gap: 8px; padding: 10px; align-content: start; }
    .card { border: 1px dashed #bbb; border-radius: 6px; padding: 8px; display: grid; grid-template-columns: 44px 1fr auto; gap: 8px; align-items: center; min-height: 88px; }
    .icon { font-size: 30px; text-align: center; }
    .txt { font-size: 14px; font-weight: 700; }
    .slot { font-size: 12px; color: #333; margin-top: 4px; }
    .slot-btn img { width: 28px; height: 28px; display: block; }
    .right { border: 1px solid var(--line); background: var(--panel-bg); display: grid; grid-template-rows: repeat(10, 1fr); }
    .opt { border-bottom: 1px solid var(--line); padding: 6px; display: grid; grid-template-columns: 34px 1fr auto; gap: 6px; align-items: center; font-size: 13px; }
    .opt:last-child { border-bottom: 0; }
    .oid { font-weight: 700; text-align: center; }
    .ans-btn img { width: 24px; height: 24px; display: block; }
    @media print { body { background: #fff; padding: 0; } .sheet { border: 1px solid #444; } }
  </style>
</head>
<body>
  <article class="sheet">
    <header class="header">
      <div>
        <div class="title">Answer Side: Match your front attempt with the correct button next to each option.</div>
        <div class="meta">Worksheet ID: WS_S301_SET03_BABY_ANIMALS | Structure: LP_FIXED_V1 | Side: Flip</div>
      </div>
      <div class="badge">3</div>
    </header>
    <section class="board">
      <div class="left">
        <div class="card"><div class="icon">🦁</div><div><div class="txt">Lion</div><div class="slot">Slot S6</div></div><div class="slot-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Red%20button%20with%20white%20center%20circle%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%23E74C3C%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2211%22%20fill%3D%22%23FFFFFF%22%20stroke%3D%22%23999%22%20stroke-width%3D%221.2%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S6" /></div></div>
        <div class="card"><div class="icon">🐱</div><div><div class="txt">Cat</div><div class="slot">Slot S2</div></div><div class="slot-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Green%20button%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%232ECC71%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S2" /></div></div>
        <div class="card"><div class="icon">🐑</div><div><div class="txt">Sheep</div><div class="slot">Slot S9</div></div><div class="slot-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Yellow%20button%20with%20white%20center%20circle%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%23F1C40F%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2211%22%20fill%3D%22%23FFFFFF%22%20stroke%3D%22%23999%22%20stroke-width%3D%221.2%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S9" /></div></div>
        <div class="card"><div class="icon">🐶</div><div><div class="txt">Dog</div><div class="slot">Slot S1</div></div><div class="slot-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Red%20button%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%23E74C3C%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S1" /></div></div>
        <div class="card"><div class="icon">🐴</div><div><div class="txt">Horse</div><div class="slot">Slot S4</div></div><div class="slot-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Yellow%20button%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%23F1C40F%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S4" /></div></div>
        <div class="card"><div class="icon">🐸</div><div><div class="txt">Frog</div><div class="slot">Slot S8</div></div><div class="slot-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Blue%20button%20with%20white%20center%20circle%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%233498DB%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2211%22%20fill%3D%22%23FFFFFF%22%20stroke%3D%22%23999%22%20stroke-width%3D%221.2%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S8" /></div></div>
        <div class="card"><div class="icon">🦌</div><div><div class="txt">Deer</div><div class="slot">Slot S10</div></div><div class="slot-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Orange%20button%20with%20white%20center%20circle%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%23E67E22%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2211%22%20fill%3D%22%23FFFFFF%22%20stroke%3D%22%23999%22%20stroke-width%3D%221.2%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S10" /></div></div>
        <div class="card"><div class="icon">🐄</div><div><div class="txt">Cow</div><div class="slot">Slot S3</div></div><div class="slot-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Blue%20button%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%233498DB%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S3" /></div></div>
        <div class="card"><div class="icon">🐐</div><div><div class="txt">Goat</div><div class="slot">Slot S5</div></div><div class="slot-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Orange%20button%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%23E67E22%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S5" /></div></div>
        <div class="card"><div class="icon">🐔</div><div><div class="txt">Hen</div><div class="slot">Slot S7</div></div><div class="slot-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Green%20button%20with%20white%20center%20circle%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%232ECC71%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2211%22%20fill%3D%22%23FFFFFF%22%20stroke%3D%22%23999%22%20stroke-width%3D%221.2%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S7" /></div></div>
      </div>
      <aside class="right">
        <div class="opt"><div class="oid">R4</div><div>Foal</div><div class="ans-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Yellow%20button%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%23F1C40F%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S4" /></div></div>
        <div class="opt"><div class="oid">R10</div><div>Fawn</div><div class="ans-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Orange%20button%20with%20white%20center%20circle%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%23E67E22%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2211%22%20fill%3D%22%23FFFFFF%22%20stroke%3D%22%23999%22%20stroke-width%3D%221.2%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S10" /></div></div>
        <div class="opt"><div class="oid">R2</div><div>Kitten</div><div class="ans-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Green%20button%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%232ECC71%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S2" /></div></div>
        <div class="opt"><div class="oid">R8</div><div>Tadpole</div><div class="ans-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Blue%20button%20with%20white%20center%20circle%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%233498DB%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2211%22%20fill%3D%22%23FFFFFF%22%20stroke%3D%22%23999%22%20stroke-width%3D%221.2%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S8" /></div></div>
        <div class="opt"><div class="oid">R6</div><div>Cub</div><div class="ans-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Red%20button%20with%20white%20center%20circle%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%23E74C3C%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2211%22%20fill%3D%22%23FFFFFF%22%20stroke%3D%22%23999%22%20stroke-width%3D%221.2%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S6" /></div></div>
        <div class="opt"><div class="oid">R1</div><div>Puppy</div><div class="ans-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Red%20button%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%23E74C3C%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S1" /></div></div>
        <div class="opt"><div class="oid">R9</div><div>Lamb</div><div class="ans-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Yellow%20button%20with%20white%20center%20circle%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%23F1C40F%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2211%22%20fill%3D%22%23FFFFFF%22%20stroke%3D%22%23999%22%20stroke-width%3D%221.2%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S9" /></div></div>
        <div class="opt"><div class="oid">R5</div><div>Kid</div><div class="ans-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Orange%20button%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%23E67E22%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S5" /></div></div>
        <div class="opt"><div class="oid">R3</div><div>Calf</div><div class="ans-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Blue%20button%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%233498DB%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S3" /></div></div>
        <div class="opt"><div class="oid">R7</div><div>Chick</div><div class="ans-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Green%20button%20with%20white%20center%20circle%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%232ECC71%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2211%22%20fill%3D%22%23FFFFFF%22%20stroke%3D%22%23999%22%20stroke-width%3D%221.2%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S7" /></div></div>
      </aside>
    </section>
  </article>
</body>
</html>
`,
  },
  {
    id: 'ws_s301_set04_country_capitals',
    title: 'Set04 Country Capitals',
    color: '#2563eb',
    frontHtml: `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>WS_S301_SET04_COUNTRY_CAPITALS Front</title>
  <style>
    :root { --w: 794px; --h: 1123px; --line: #666; --head-bg: #d8efcb; --head-border: #80aa75; --panel-bg: #f8f8f4; }
    * { box-sizing: border-box; }
    body { margin: 0; padding: 18px; background: #ecefe8; font-family: "Trebuchet MS", Verdana, sans-serif; }
    .sheet { width: var(--w); height: var(--h); margin: 0 auto; background: #fff; border: 1.4px solid var(--line); position: relative; }
    .header { margin: 10px; border: 1px solid var(--head-border); background: var(--head-bg); padding: 10px 12px; display: grid; grid-template-columns: 1fr auto; gap: 10px; align-items: center; }
    .title { font-size: 15px; font-weight: 700; }
    .meta { font-size: 12px; color: #333; margin-top: 2px; }
    .badge { width: 36px; height: 36px; border-radius: 50%; border: 1px solid var(--line); display: grid; place-items: center; font-weight: 700; background: #f3f3f3; }
    .board { margin: 0 10px 10px; height: calc(100% - 92px); display: grid; grid-template-columns: 1fr 220px; gap: 10px; }
    .left { border: 1px solid var(--line); background: #fff; display: grid; grid-template-columns: 1fr 1fr; gap: 8px; padding: 10px; align-content: start; }
    .card { border: 1px dashed #bbb; border-radius: 6px; padding: 8px; display: grid; grid-template-columns: 44px 1fr auto; gap: 8px; align-items: center; min-height: 88px; }
    .icon { font-size: 30px; text-align: center; }
    .txt { font-size: 14px; font-weight: 700; }
    .slot { font-size: 12px; color: #333; margin-top: 4px; }
    .slot-btn img { width: 28px; height: 28px; display: block; }
    .right { border: 1px solid var(--line); background: var(--panel-bg); display: grid; grid-template-rows: repeat(10, 1fr); }
    .opt { border-bottom: 1px solid var(--line); padding: 6px; display: grid; grid-template-columns: 36px 1fr; gap: 6px; align-items: center; font-size: 13px; }
    .opt:last-child { border-bottom: 0; }
    .oid { font-weight: 700; text-align: center; }
    @media print { body { background: #fff; padding: 0; } .sheet { border: 1px solid #444; } }
  </style>
</head>
<body>
  <article class="sheet">
    <header class="header">
      <div>
        <div class="title">Match each country with its capital city.</div>
        <div class="meta">Worksheet ID: WS_S301_SET04_COUNTRY_CAPITALS | Structure: LP_FIXED_V1 | Side: Front</div>
      </div>
      <div class="badge">4</div>
    </header>
    <section class="board">
      <div class="left">
        <div class="card"><div class="icon">🇫🇷</div><div><div class="txt">France</div><div class="slot">Slot S3</div></div><div class="slot-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Blue%20button%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%233498DB%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S3" /></div></div>
        <div class="card"><div class="icon">🇧🇷</div><div><div class="txt">Brazil</div><div class="slot">Slot S8</div></div><div class="slot-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Blue%20button%20with%20white%20center%20circle%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%233498DB%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2211%22%20fill%3D%22%23FFFFFF%22%20stroke%3D%22%23999%22%20stroke-width%3D%221.2%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S8" /></div></div>
        <div class="card"><div class="icon">🇮🇳</div><div><div class="txt">India</div><div class="slot">Slot S1</div></div><div class="slot-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Red%20button%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%23E74C3C%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S1" /></div></div>
        <div class="card"><div class="icon">🇹🇭</div><div><div class="txt">Thailand</div><div class="slot">Slot S10</div></div><div class="slot-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Orange%20button%20with%20white%20center%20circle%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%23E67E22%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2211%22%20fill%3D%22%23FFFFFF%22%20stroke%3D%22%23999%22%20stroke-width%3D%221.2%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S10" /></div></div>
        <div class="card"><div class="icon">🇳🇵</div><div><div class="txt">Nepal</div><div class="slot">Slot S5</div></div><div class="slot-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Orange%20button%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%23E67E22%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S5" /></div></div>
        <div class="card"><div class="icon">🇯🇵</div><div><div class="txt">Japan</div><div class="slot">Slot S2</div></div><div class="slot-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Green%20button%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%232ECC71%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S2" /></div></div>
        <div class="card"><div class="icon">🇨🇦</div><div><div class="txt">Canada</div><div class="slot">Slot S7</div></div><div class="slot-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Green%20button%20with%20white%20center%20circle%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%232ECC71%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2211%22%20fill%3D%22%23FFFFFF%22%20stroke%3D%22%23999%22%20stroke-width%3D%221.2%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S7" /></div></div>
        <div class="card"><div class="icon">🇮🇹</div><div><div class="txt">Italy</div><div class="slot">Slot S4</div></div><div class="slot-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Yellow%20button%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%23F1C40F%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S4" /></div></div>
        <div class="card"><div class="icon">🇪🇬</div><div><div class="txt">Egypt</div><div class="slot">Slot S9</div></div><div class="slot-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Yellow%20button%20with%20white%20center%20circle%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%23F1C40F%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2211%22%20fill%3D%22%23FFFFFF%22%20stroke%3D%22%23999%22%20stroke-width%3D%221.2%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S9" /></div></div>
        <div class="card"><div class="icon">🇦🇺</div><div><div class="txt">Australia</div><div class="slot">Slot S6</div></div><div class="slot-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Red%20button%20with%20white%20center%20circle%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%23E74C3C%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2211%22%20fill%3D%22%23FFFFFF%22%20stroke%3D%22%23999%22%20stroke-width%3D%221.2%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S6" /></div></div>
      </div>
      <aside class="right">
        <div class="opt"><div class="oid">R7</div><div>Ottawa</div></div>
        <div class="opt"><div class="oid">R1</div><div>New Delhi</div></div>
        <div class="opt"><div class="oid">R9</div><div>Cairo</div></div>
        <div class="opt"><div class="oid">R4</div><div>Rome</div></div>
        <div class="opt"><div class="oid">R6</div><div>Canberra</div></div>
        <div class="opt"><div class="oid">R2</div><div>Tokyo</div></div>
        <div class="opt"><div class="oid">R10</div><div>Bangkok</div></div>
        <div class="opt"><div class="oid">R8</div><div>Brasilia</div></div>
        <div class="opt"><div class="oid">R5</div><div>Kathmandu</div></div>
        <div class="opt"><div class="oid">R3</div><div>Paris</div></div>
      </aside>
    </section>
  </article>
</body>
</html>
`,
    backHtml: `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>WS_S301_SET04_COUNTRY_CAPITALS Flip</title>
  <style>
    :root { --w: 794px; --h: 1123px; --line: #666; --head-bg: #feeec9; --head-border: #b28d44; --panel-bg: #faf7ef; }
    * { box-sizing: border-box; }
    body { margin: 0; padding: 18px; background: #ecefe8; font-family: "Trebuchet MS", Verdana, sans-serif; }
    .sheet { width: var(--w); height: var(--h); margin: 0 auto; background: #fff; border: 1.4px solid var(--line); position: relative; }
    .header { margin: 10px; border: 1px solid var(--head-border); background: var(--head-bg); padding: 10px 12px; display: grid; grid-template-columns: 1fr auto; gap: 10px; align-items: center; }
    .title { font-size: 15px; font-weight: 700; }
    .meta { font-size: 12px; color: #333; margin-top: 2px; }
    .badge { width: 36px; height: 36px; border-radius: 50%; border: 1px solid var(--line); display: grid; place-items: center; font-weight: 700; background: #f3f3f3; }
    .board { margin: 0 10px 10px; height: calc(100% - 92px); display: grid; grid-template-columns: 1fr 220px; gap: 10px; }
    .left { border: 1px solid var(--line); background: #fff; display: grid; grid-template-columns: 1fr 1fr; gap: 8px; padding: 10px; align-content: start; }
    .card { border: 1px dashed #bbb; border-radius: 6px; padding: 8px; display: grid; grid-template-columns: 44px 1fr auto; gap: 8px; align-items: center; min-height: 88px; }
    .icon { font-size: 30px; text-align: center; }
    .txt { font-size: 14px; font-weight: 700; }
    .slot { font-size: 12px; color: #333; margin-top: 4px; }
    .slot-btn img { width: 28px; height: 28px; display: block; }
    .right { border: 1px solid var(--line); background: var(--panel-bg); display: grid; grid-template-rows: repeat(10, 1fr); }
    .opt { border-bottom: 1px solid var(--line); padding: 6px; display: grid; grid-template-columns: 34px 1fr auto; gap: 6px; align-items: center; font-size: 13px; }
    .opt:last-child { border-bottom: 0; }
    .oid { font-weight: 700; text-align: center; }
    .ans-btn img { width: 24px; height: 24px; display: block; }
    @media print { body { background: #fff; padding: 0; } .sheet { border: 1px solid #444; } }
  </style>
</head>
<body>
  <article class="sheet">
    <header class="header">
      <div>
        <div class="title">Answer Side: Match your front attempt with the correct button next to each option.</div>
        <div class="meta">Worksheet ID: WS_S301_SET04_COUNTRY_CAPITALS | Structure: LP_FIXED_V1 | Side: Flip</div>
      </div>
      <div class="badge">4</div>
    </header>
    <section class="board">
      <div class="left">
        <div class="card"><div class="icon">🇫🇷</div><div><div class="txt">France</div><div class="slot">Slot S3</div></div><div class="slot-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Blue%20button%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%233498DB%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S3" /></div></div>
        <div class="card"><div class="icon">🇧🇷</div><div><div class="txt">Brazil</div><div class="slot">Slot S8</div></div><div class="slot-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Blue%20button%20with%20white%20center%20circle%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%233498DB%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2211%22%20fill%3D%22%23FFFFFF%22%20stroke%3D%22%23999%22%20stroke-width%3D%221.2%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S8" /></div></div>
        <div class="card"><div class="icon">🇮🇳</div><div><div class="txt">India</div><div class="slot">Slot S1</div></div><div class="slot-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Red%20button%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%23E74C3C%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S1" /></div></div>
        <div class="card"><div class="icon">🇹🇭</div><div><div class="txt">Thailand</div><div class="slot">Slot S10</div></div><div class="slot-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Orange%20button%20with%20white%20center%20circle%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%23E67E22%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2211%22%20fill%3D%22%23FFFFFF%22%20stroke%3D%22%23999%22%20stroke-width%3D%221.2%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S10" /></div></div>
        <div class="card"><div class="icon">🇳🇵</div><div><div class="txt">Nepal</div><div class="slot">Slot S5</div></div><div class="slot-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Orange%20button%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%23E67E22%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S5" /></div></div>
        <div class="card"><div class="icon">🇯🇵</div><div><div class="txt">Japan</div><div class="slot">Slot S2</div></div><div class="slot-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Green%20button%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%232ECC71%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S2" /></div></div>
        <div class="card"><div class="icon">🇨🇦</div><div><div class="txt">Canada</div><div class="slot">Slot S7</div></div><div class="slot-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Green%20button%20with%20white%20center%20circle%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%232ECC71%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2211%22%20fill%3D%22%23FFFFFF%22%20stroke%3D%22%23999%22%20stroke-width%3D%221.2%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S7" /></div></div>
        <div class="card"><div class="icon">🇮🇹</div><div><div class="txt">Italy</div><div class="slot">Slot S4</div></div><div class="slot-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Yellow%20button%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%23F1C40F%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S4" /></div></div>
        <div class="card"><div class="icon">🇪🇬</div><div><div class="txt">Egypt</div><div class="slot">Slot S9</div></div><div class="slot-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Yellow%20button%20with%20white%20center%20circle%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%23F1C40F%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2211%22%20fill%3D%22%23FFFFFF%22%20stroke%3D%22%23999%22%20stroke-width%3D%221.2%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S9" /></div></div>
        <div class="card"><div class="icon">🇦🇺</div><div><div class="txt">Australia</div><div class="slot">Slot S6</div></div><div class="slot-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Red%20button%20with%20white%20center%20circle%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%23E74C3C%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2211%22%20fill%3D%22%23FFFFFF%22%20stroke%3D%22%23999%22%20stroke-width%3D%221.2%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S6" /></div></div>
      </div>
      <aside class="right">
        <div class="opt"><div class="oid">R7</div><div>Ottawa</div><div class="ans-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Green%20button%20with%20white%20center%20circle%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%232ECC71%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2211%22%20fill%3D%22%23FFFFFF%22%20stroke%3D%22%23999%22%20stroke-width%3D%221.2%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S7" /></div></div>
        <div class="opt"><div class="oid">R1</div><div>New Delhi</div><div class="ans-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Red%20button%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%23E74C3C%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S1" /></div></div>
        <div class="opt"><div class="oid">R9</div><div>Cairo</div><div class="ans-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Yellow%20button%20with%20white%20center%20circle%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%23F1C40F%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2211%22%20fill%3D%22%23FFFFFF%22%20stroke%3D%22%23999%22%20stroke-width%3D%221.2%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S9" /></div></div>
        <div class="opt"><div class="oid">R4</div><div>Rome</div><div class="ans-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Yellow%20button%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%23F1C40F%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S4" /></div></div>
        <div class="opt"><div class="oid">R6</div><div>Canberra</div><div class="ans-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Red%20button%20with%20white%20center%20circle%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%23E74C3C%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2211%22%20fill%3D%22%23FFFFFF%22%20stroke%3D%22%23999%22%20stroke-width%3D%221.2%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S6" /></div></div>
        <div class="opt"><div class="oid">R2</div><div>Tokyo</div><div class="ans-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Green%20button%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%232ECC71%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S2" /></div></div>
        <div class="opt"><div class="oid">R10</div><div>Bangkok</div><div class="ans-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Orange%20button%20with%20white%20center%20circle%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%23E67E22%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2211%22%20fill%3D%22%23FFFFFF%22%20stroke%3D%22%23999%22%20stroke-width%3D%221.2%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S10" /></div></div>
        <div class="opt"><div class="oid">R8</div><div>Brasilia</div><div class="ans-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Blue%20button%20with%20white%20center%20circle%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%233498DB%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2211%22%20fill%3D%22%23FFFFFF%22%20stroke%3D%22%23999%22%20stroke-width%3D%221.2%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S8" /></div></div>
        <div class="opt"><div class="oid">R5</div><div>Kathmandu</div><div class="ans-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Orange%20button%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%23E67E22%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S5" /></div></div>
        <div class="opt"><div class="oid">R3</div><div>Paris</div><div class="ans-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Blue%20button%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%233498DB%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S3" /></div></div>
      </aside>
    </section>
  </article>
</body>
</html>
`,
  },
  {
    id: 'ws_s301_set05_inventor_invention',
    title: 'Set05 Inventor Invention',
    color: '#f59e0b',
    frontHtml: `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>WS_S301_SET05_INVENTOR_INVENTION Front</title>
  <style>
    :root { --w: 794px; --h: 1123px; --line: #666; --head-bg: #d8efcb; --head-border: #80aa75; --panel-bg: #f8f8f4; }
    * { box-sizing: border-box; }
    body { margin: 0; padding: 18px; background: #ecefe8; font-family: "Trebuchet MS", Verdana, sans-serif; }
    .sheet { width: var(--w); height: var(--h); margin: 0 auto; background: #fff; border: 1.4px solid var(--line); position: relative; }
    .header { margin: 10px; border: 1px solid var(--head-border); background: var(--head-bg); padding: 10px 12px; display: grid; grid-template-columns: 1fr auto; gap: 10px; align-items: center; }
    .title { font-size: 15px; font-weight: 700; }
    .meta { font-size: 12px; color: #333; margin-top: 2px; }
    .badge { width: 36px; height: 36px; border-radius: 50%; border: 1px solid var(--line); display: grid; place-items: center; font-weight: 700; background: #f3f3f3; }
    .board { margin: 0 10px 10px; height: calc(100% - 92px); display: grid; grid-template-columns: 1fr 220px; gap: 10px; }
    .left { border: 1px solid var(--line); background: #fff; display: grid; grid-template-columns: 1fr 1fr; gap: 8px; padding: 10px; align-content: start; }
    .card { border: 1px dashed #bbb; border-radius: 6px; padding: 8px; display: grid; grid-template-columns: 44px 1fr auto; gap: 8px; align-items: center; min-height: 88px; }
    .icon { font-size: 30px; text-align: center; }
    .txt { font-size: 14px; font-weight: 700; }
    .slot { font-size: 12px; color: #333; margin-top: 4px; }
    .slot-btn img { width: 28px; height: 28px; display: block; }
    .right { border: 1px solid var(--line); background: var(--panel-bg); display: grid; grid-template-rows: repeat(10, 1fr); }
    .opt { border-bottom: 1px solid var(--line); padding: 6px; display: grid; grid-template-columns: 36px 1fr; gap: 6px; align-items: center; font-size: 13px; }
    .opt:last-child { border-bottom: 0; }
    .oid { font-weight: 700; text-align: center; }
    @media print { body { background: #fff; padding: 0; } .sheet { border: 1px solid #444; } }
  </style>
</head>
<body>
  <article class="sheet">
    <header class="header">
      <div>
        <div class="title">Match each inventor with the invention.</div>
        <div class="meta">Worksheet ID: WS_S301_SET05_INVENTOR_INVENTION | Structure: LP_FIXED_V1 | Side: Front</div>
      </div>
      <div class="badge">5</div>
    </header>
    <section class="board">
      <div class="left">
        <div class="card"><div class="icon">🧮</div><div><div class="txt">Blaise Pascal</div><div class="slot">Slot S9</div></div><div class="slot-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Yellow%20button%20with%20white%20center%20circle%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%23F1C40F%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2211%22%20fill%3D%22%23FFFFFF%22%20stroke%3D%22%23999%22%20stroke-width%3D%221.2%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S9" /></div></div>
        <div class="card"><div class="icon">🖨️</div><div><div class="txt">Johannes Gutenberg</div><div class="slot">Slot S4</div></div><div class="slot-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Yellow%20button%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%23F1C40F%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S4" /></div></div>
        <div class="card"><div class="icon">💡</div><div><div class="txt">Thomas Edison</div><div class="slot">Slot S1</div></div><div class="slot-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Red%20button%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%23E74C3C%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S1" /></div></div>
        <div class="card"><div class="icon">🌐</div><div><div class="txt">Tim Berners-Lee</div><div class="slot">Slot S7</div></div><div class="slot-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Green%20button%20with%20white%20center%20circle%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%232ECC71%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2211%22%20fill%3D%22%23FFFFFF%22%20stroke%3D%22%23999%22%20stroke-width%3D%221.2%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S7" /></div></div>
        <div class="card"><div class="icon">🔤</div><div><div class="txt">Louis Braille</div><div class="slot">Slot S10</div></div><div class="slot-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Orange%20button%20with%20white%20center%20circle%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%23E67E22%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2211%22%20fill%3D%22%23FFFFFF%22%20stroke%3D%22%23999%22%20stroke-width%3D%221.2%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S10" /></div></div>
        <div class="card"><div class="icon">✈️</div><div><div class="txt">Wright Brothers</div><div class="slot">Slot S3</div></div><div class="slot-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Blue%20button%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%233498DB%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S3" /></div></div>
        <div class="card"><div class="icon">🚂</div><div><div class="txt">James Watt</div><div class="slot">Slot S6</div></div><div class="slot-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Red%20button%20with%20white%20center%20circle%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%23E74C3C%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2211%22%20fill%3D%22%23FFFFFF%22%20stroke%3D%22%23999%22%20stroke-width%3D%221.2%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S6" /></div></div>
        <div class="card"><div class="icon">☎️</div><div><div class="txt">Alexander Graham Bell</div><div class="slot">Slot S2</div></div><div class="slot-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Green%20button%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%232ECC71%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S2" /></div></div>
        <div class="card"><div class="icon">📻</div><div><div class="txt">Guglielmo Marconi</div><div class="slot">Slot S8</div></div><div class="slot-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Blue%20button%20with%20white%20center%20circle%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%233498DB%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2211%22%20fill%3D%22%23FFFFFF%22%20stroke%3D%22%23999%22%20stroke-width%3D%221.2%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S8" /></div></div>
        <div class="card"><div class="icon">📺</div><div><div class="txt">John Logie Baird</div><div class="slot">Slot S5</div></div><div class="slot-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Orange%20button%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%23E67E22%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S5" /></div></div>
      </div>
      <aside class="right">
        <div class="opt"><div class="oid">R3</div><div>Airplane</div></div>
        <div class="opt"><div class="oid">R10</div><div>Braille Script</div></div>
        <div class="opt"><div class="oid">R1</div><div>Electric Bulb</div></div>
        <div class="opt"><div class="oid">R5</div><div>Television</div></div>
        <div class="opt"><div class="oid">R8</div><div>Radio</div></div>
        <div class="opt"><div class="oid">R4</div><div>Printing Press</div></div>
        <div class="opt"><div class="oid">R7</div><div>World Wide Web</div></div>
        <div class="opt"><div class="oid">R2</div><div>Telephone</div></div>
        <div class="opt"><div class="oid">R9</div><div>Calculator</div></div>
        <div class="opt"><div class="oid">R6</div><div>Steam Engine</div></div>
      </aside>
    </section>
  </article>
</body>
</html>
`,
    backHtml: `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>WS_S301_SET05_INVENTOR_INVENTION Flip</title>
  <style>
    :root { --w: 794px; --h: 1123px; --line: #666; --head-bg: #feeec9; --head-border: #b28d44; --panel-bg: #faf7ef; }
    * { box-sizing: border-box; }
    body { margin: 0; padding: 18px; background: #ecefe8; font-family: "Trebuchet MS", Verdana, sans-serif; }
    .sheet { width: var(--w); height: var(--h); margin: 0 auto; background: #fff; border: 1.4px solid var(--line); position: relative; }
    .header { margin: 10px; border: 1px solid var(--head-border); background: var(--head-bg); padding: 10px 12px; display: grid; grid-template-columns: 1fr auto; gap: 10px; align-items: center; }
    .title { font-size: 15px; font-weight: 700; }
    .meta { font-size: 12px; color: #333; margin-top: 2px; }
    .badge { width: 36px; height: 36px; border-radius: 50%; border: 1px solid var(--line); display: grid; place-items: center; font-weight: 700; background: #f3f3f3; }
    .board { margin: 0 10px 10px; height: calc(100% - 92px); display: grid; grid-template-columns: 1fr 220px; gap: 10px; }
    .left { border: 1px solid var(--line); background: #fff; display: grid; grid-template-columns: 1fr 1fr; gap: 8px; padding: 10px; align-content: start; }
    .card { border: 1px dashed #bbb; border-radius: 6px; padding: 8px; display: grid; grid-template-columns: 44px 1fr auto; gap: 8px; align-items: center; min-height: 88px; }
    .icon { font-size: 30px; text-align: center; }
    .txt { font-size: 14px; font-weight: 700; }
    .slot { font-size: 12px; color: #333; margin-top: 4px; }
    .slot-btn img { width: 28px; height: 28px; display: block; }
    .right { border: 1px solid var(--line); background: var(--panel-bg); display: grid; grid-template-rows: repeat(10, 1fr); }
    .opt { border-bottom: 1px solid var(--line); padding: 6px; display: grid; grid-template-columns: 34px 1fr auto; gap: 6px; align-items: center; font-size: 13px; }
    .opt:last-child { border-bottom: 0; }
    .oid { font-weight: 700; text-align: center; }
    .ans-btn img { width: 24px; height: 24px; display: block; }
    @media print { body { background: #fff; padding: 0; } .sheet { border: 1px solid #444; } }
  </style>
</head>
<body>
  <article class="sheet">
    <header class="header">
      <div>
        <div class="title">Answer Side: Match your front attempt with the correct button next to each option.</div>
        <div class="meta">Worksheet ID: WS_S301_SET05_INVENTOR_INVENTION | Structure: LP_FIXED_V1 | Side: Flip</div>
      </div>
      <div class="badge">5</div>
    </header>
    <section class="board">
      <div class="left">
        <div class="card"><div class="icon">🧮</div><div><div class="txt">Blaise Pascal</div><div class="slot">Slot S9</div></div><div class="slot-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Yellow%20button%20with%20white%20center%20circle%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%23F1C40F%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2211%22%20fill%3D%22%23FFFFFF%22%20stroke%3D%22%23999%22%20stroke-width%3D%221.2%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S9" /></div></div>
        <div class="card"><div class="icon">🖨️</div><div><div class="txt">Johannes Gutenberg</div><div class="slot">Slot S4</div></div><div class="slot-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Yellow%20button%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%23F1C40F%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S4" /></div></div>
        <div class="card"><div class="icon">💡</div><div><div class="txt">Thomas Edison</div><div class="slot">Slot S1</div></div><div class="slot-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Red%20button%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%23E74C3C%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S1" /></div></div>
        <div class="card"><div class="icon">🌐</div><div><div class="txt">Tim Berners-Lee</div><div class="slot">Slot S7</div></div><div class="slot-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Green%20button%20with%20white%20center%20circle%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%232ECC71%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2211%22%20fill%3D%22%23FFFFFF%22%20stroke%3D%22%23999%22%20stroke-width%3D%221.2%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S7" /></div></div>
        <div class="card"><div class="icon">🔤</div><div><div class="txt">Louis Braille</div><div class="slot">Slot S10</div></div><div class="slot-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Orange%20button%20with%20white%20center%20circle%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%23E67E22%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2211%22%20fill%3D%22%23FFFFFF%22%20stroke%3D%22%23999%22%20stroke-width%3D%221.2%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S10" /></div></div>
        <div class="card"><div class="icon">✈️</div><div><div class="txt">Wright Brothers</div><div class="slot">Slot S3</div></div><div class="slot-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Blue%20button%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%233498DB%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S3" /></div></div>
        <div class="card"><div class="icon">🚂</div><div><div class="txt">James Watt</div><div class="slot">Slot S6</div></div><div class="slot-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Red%20button%20with%20white%20center%20circle%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%23E74C3C%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2211%22%20fill%3D%22%23FFFFFF%22%20stroke%3D%22%23999%22%20stroke-width%3D%221.2%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S6" /></div></div>
        <div class="card"><div class="icon">☎️</div><div><div class="txt">Alexander Graham Bell</div><div class="slot">Slot S2</div></div><div class="slot-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Green%20button%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%232ECC71%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S2" /></div></div>
        <div class="card"><div class="icon">📻</div><div><div class="txt">Guglielmo Marconi</div><div class="slot">Slot S8</div></div><div class="slot-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Blue%20button%20with%20white%20center%20circle%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%233498DB%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2211%22%20fill%3D%22%23FFFFFF%22%20stroke%3D%22%23999%22%20stroke-width%3D%221.2%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S8" /></div></div>
        <div class="card"><div class="icon">📺</div><div><div class="txt">John Logie Baird</div><div class="slot">Slot S5</div></div><div class="slot-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Orange%20button%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%23E67E22%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S5" /></div></div>
      </div>
      <aside class="right">
        <div class="opt"><div class="oid">R3</div><div>Airplane</div><div class="ans-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Blue%20button%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%233498DB%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S3" /></div></div>
        <div class="opt"><div class="oid">R10</div><div>Braille Script</div><div class="ans-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Orange%20button%20with%20white%20center%20circle%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%23E67E22%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2211%22%20fill%3D%22%23FFFFFF%22%20stroke%3D%22%23999%22%20stroke-width%3D%221.2%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S10" /></div></div>
        <div class="opt"><div class="oid">R1</div><div>Electric Bulb</div><div class="ans-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Red%20button%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%23E74C3C%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S1" /></div></div>
        <div class="opt"><div class="oid">R5</div><div>Television</div><div class="ans-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Orange%20button%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%23E67E22%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S5" /></div></div>
        <div class="opt"><div class="oid">R8</div><div>Radio</div><div class="ans-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Blue%20button%20with%20white%20center%20circle%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%233498DB%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2211%22%20fill%3D%22%23FFFFFF%22%20stroke%3D%22%23999%22%20stroke-width%3D%221.2%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S8" /></div></div>
        <div class="opt"><div class="oid">R4</div><div>Printing Press</div><div class="ans-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Yellow%20button%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%23F1C40F%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S4" /></div></div>
        <div class="opt"><div class="oid">R7</div><div>World Wide Web</div><div class="ans-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Green%20button%20with%20white%20center%20circle%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%232ECC71%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2211%22%20fill%3D%22%23FFFFFF%22%20stroke%3D%22%23999%22%20stroke-width%3D%221.2%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S7" /></div></div>
        <div class="opt"><div class="oid">R2</div><div>Telephone</div><div class="ans-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Green%20button%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%232ECC71%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S2" /></div></div>
        <div class="opt"><div class="oid">R9</div><div>Calculator</div><div class="ans-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Yellow%20button%20with%20white%20center%20circle%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%23F1C40F%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2211%22%20fill%3D%22%23FFFFFF%22%20stroke%3D%22%23999%22%20stroke-width%3D%221.2%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S9" /></div></div>
        <div class="opt"><div class="oid">R6</div><div>Steam Engine</div><div class="ans-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Red%20button%20with%20white%20center%20circle%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%23E74C3C%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2211%22%20fill%3D%22%23FFFFFF%22%20stroke%3D%22%23999%22%20stroke-width%3D%221.2%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S6" /></div></div>
      </aside>
    </section>
  </article>
</body>
</html>
`,
  },
  {
    id: 'ws_s301_set06_plant_parts_functions',
    title: 'Set06 Plant Parts Functions',
    color: '#f97316',
    frontHtml: `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>WS_S301_SET06_PLANT_PARTS_FUNCTIONS Front</title>
  <style>
    :root { --w: 794px; --h: 1123px; --line: #666; --head-bg: #d8efcb; --head-border: #80aa75; --panel-bg: #f8f8f4; }
    * { box-sizing: border-box; }
    body { margin: 0; padding: 18px; background: #ecefe8; font-family: "Trebuchet MS", Verdana, sans-serif; }
    .sheet { width: var(--w); height: var(--h); margin: 0 auto; background: #fff; border: 1.4px solid var(--line); position: relative; }
    .header { margin: 10px; border: 1px solid var(--head-border); background: var(--head-bg); padding: 10px 12px; display: grid; grid-template-columns: 1fr auto; gap: 10px; align-items: center; }
    .title { font-size: 15px; font-weight: 700; }
    .meta { font-size: 12px; color: #333; margin-top: 2px; }
    .badge { width: 36px; height: 36px; border-radius: 50%; border: 1px solid var(--line); display: grid; place-items: center; font-weight: 700; background: #f3f3f3; }
    .board { margin: 0 10px 10px; height: calc(100% - 92px); display: grid; grid-template-columns: 1fr 220px; gap: 10px; }
    .left { border: 1px solid var(--line); background: #fff; display: grid; grid-template-columns: 1fr 1fr; gap: 8px; padding: 10px; align-content: start; }
    .card { border: 1px dashed #bbb; border-radius: 6px; padding: 8px; display: grid; grid-template-columns: 44px 1fr auto; gap: 8px; align-items: center; min-height: 88px; }
    .icon { font-size: 30px; text-align: center; }
    .txt { font-size: 14px; font-weight: 700; }
    .slot { font-size: 12px; color: #333; margin-top: 4px; }
    .slot-btn img { width: 28px; height: 28px; display: block; }
    .right { border: 1px solid var(--line); background: var(--panel-bg); display: grid; grid-template-rows: repeat(10, 1fr); }
    .opt { border-bottom: 1px solid var(--line); padding: 6px; display: grid; grid-template-columns: 36px 1fr; gap: 6px; align-items: center; font-size: 13px; }
    .opt:last-child { border-bottom: 0; }
    .oid { font-weight: 700; text-align: center; }
    @media print { body { background: #fff; padding: 0; } .sheet { border: 1px solid #444; } }
  </style>
</head>
<body>
  <article class="sheet">
    <header class="header">
      <div>
        <div class="title">Match each plant part with its function.</div>
        <div class="meta">Worksheet ID: WS_S301_SET06_PLANT_PARTS_FUNCTIONS | Structure: LP_FIXED_V1 | Side: Front</div>
      </div>
      <div class="badge">6</div>
    </header>
    <section class="board">
      <div class="left">
        <div class="card"><div class="icon">🪴</div><div><div class="txt">Stem</div><div class="slot">Slot S2</div></div><div class="slot-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Green%20button%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%232ECC71%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S2" /></div></div>
        <div class="card"><div class="icon">🌺</div><div><div class="txt">Petal</div><div class="slot">Slot S10</div></div><div class="slot-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Orange%20button%20with%20white%20center%20circle%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%23E67E22%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2211%22%20fill%3D%22%23FFFFFF%22%20stroke%3D%22%23999%22%20stroke-width%3D%221.2%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S10" /></div></div>
        <div class="card"><div class="icon">🍎</div><div><div class="txt">Fruit</div><div class="slot">Slot S5</div></div><div class="slot-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Orange%20button%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%23E67E22%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S5" /></div></div>
        <div class="card"><div class="icon">🌱</div><div><div class="txt">Root</div><div class="slot">Slot S1</div></div><div class="slot-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Red%20button%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%23E74C3C%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S1" /></div></div>
        <div class="card"><div class="icon">🪵</div><div><div class="txt">Bark</div><div class="slot">Slot S8</div></div><div class="slot-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Blue%20button%20with%20white%20center%20circle%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%233498DB%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2211%22%20fill%3D%22%23FFFFFF%22%20stroke%3D%22%23999%22%20stroke-width%3D%221.2%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S8" /></div></div>
        <div class="card"><div class="icon">🌸</div><div><div class="txt">Flower</div><div class="slot">Slot S4</div></div><div class="slot-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Yellow%20button%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%23F1C40F%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S4" /></div></div>
        <div class="card"><div class="icon">🧬</div><div><div class="txt">Vein</div><div class="slot">Slot S9</div></div><div class="slot-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Yellow%20button%20with%20white%20center%20circle%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%23F1C40F%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2211%22%20fill%3D%22%23FFFFFF%22%20stroke%3D%22%23999%22%20stroke-width%3D%221.2%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S9" /></div></div>
        <div class="card"><div class="icon">🍃</div><div><div class="txt">Leaf</div><div class="slot">Slot S3</div></div><div class="slot-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Blue%20button%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%233498DB%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S3" /></div></div>
        <div class="card"><div class="icon">🌰</div><div><div class="txt">Seed</div><div class="slot">Slot S6</div></div><div class="slot-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Red%20button%20with%20white%20center%20circle%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%23E74C3C%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2211%22%20fill%3D%22%23FFFFFF%22%20stroke%3D%22%23999%22%20stroke-width%3D%221.2%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S6" /></div></div>
        <div class="card"><div class="icon">🌿</div><div><div class="txt">Bud</div><div class="slot">Slot S7</div></div><div class="slot-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Green%20button%20with%20white%20center%20circle%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%232ECC71%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2211%22%20fill%3D%22%23FFFFFF%22%20stroke%3D%22%23999%22%20stroke-width%3D%221.2%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S7" /></div></div>
      </div>
      <aside class="right">
        <div class="opt"><div class="oid">R6</div><div>Grows into a new plant</div></div>
        <div class="opt"><div class="oid">R2</div><div>Supports plant and transports food</div></div>
        <div class="opt"><div class="oid">R10</div><div>Attracts pollinators</div></div>
        <div class="opt"><div class="oid">R1</div><div>Absorbs water and minerals</div></div>
        <div class="opt"><div class="oid">R4</div><div>Reproduction in plants</div></div>
        <div class="opt"><div class="oid">R8</div><div>Protects the stem</div></div>
        <div class="opt"><div class="oid">R5</div><div>Protects seeds</div></div>
        <div class="opt"><div class="oid">R3</div><div>Makes food by photosynthesis</div></div>
        <div class="opt"><div class="oid">R9</div><div>Carries water and food in leaf</div></div>
        <div class="opt"><div class="oid">R7</div><div>Develops into flower or leaf</div></div>
      </aside>
    </section>
  </article>
</body>
</html>
`,
    backHtml: `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>WS_S301_SET06_PLANT_PARTS_FUNCTIONS Flip</title>
  <style>
    :root { --w: 794px; --h: 1123px; --line: #666; --head-bg: #feeec9; --head-border: #b28d44; --panel-bg: #faf7ef; }
    * { box-sizing: border-box; }
    body { margin: 0; padding: 18px; background: #ecefe8; font-family: "Trebuchet MS", Verdana, sans-serif; }
    .sheet { width: var(--w); height: var(--h); margin: 0 auto; background: #fff; border: 1.4px solid var(--line); position: relative; }
    .header { margin: 10px; border: 1px solid var(--head-border); background: var(--head-bg); padding: 10px 12px; display: grid; grid-template-columns: 1fr auto; gap: 10px; align-items: center; }
    .title { font-size: 15px; font-weight: 700; }
    .meta { font-size: 12px; color: #333; margin-top: 2px; }
    .badge { width: 36px; height: 36px; border-radius: 50%; border: 1px solid var(--line); display: grid; place-items: center; font-weight: 700; background: #f3f3f3; }
    .board { margin: 0 10px 10px; height: calc(100% - 92px); display: grid; grid-template-columns: 1fr 220px; gap: 10px; }
    .left { border: 1px solid var(--line); background: #fff; display: grid; grid-template-columns: 1fr 1fr; gap: 8px; padding: 10px; align-content: start; }
    .card { border: 1px dashed #bbb; border-radius: 6px; padding: 8px; display: grid; grid-template-columns: 44px 1fr auto; gap: 8px; align-items: center; min-height: 88px; }
    .icon { font-size: 30px; text-align: center; }
    .txt { font-size: 14px; font-weight: 700; }
    .slot { font-size: 12px; color: #333; margin-top: 4px; }
    .slot-btn img { width: 28px; height: 28px; display: block; }
    .right { border: 1px solid var(--line); background: var(--panel-bg); display: grid; grid-template-rows: repeat(10, 1fr); }
    .opt { border-bottom: 1px solid var(--line); padding: 6px; display: grid; grid-template-columns: 34px 1fr auto; gap: 6px; align-items: center; font-size: 13px; }
    .opt:last-child { border-bottom: 0; }
    .oid { font-weight: 700; text-align: center; }
    .ans-btn img { width: 24px; height: 24px; display: block; }
    @media print { body { background: #fff; padding: 0; } .sheet { border: 1px solid #444; } }
  </style>
</head>
<body>
  <article class="sheet">
    <header class="header">
      <div>
        <div class="title">Answer Side: Match your front attempt with the correct button next to each option.</div>
        <div class="meta">Worksheet ID: WS_S301_SET06_PLANT_PARTS_FUNCTIONS | Structure: LP_FIXED_V1 | Side: Flip</div>
      </div>
      <div class="badge">6</div>
    </header>
    <section class="board">
      <div class="left">
        <div class="card"><div class="icon">🪴</div><div><div class="txt">Stem</div><div class="slot">Slot S2</div></div><div class="slot-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Green%20button%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%232ECC71%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S2" /></div></div>
        <div class="card"><div class="icon">🌺</div><div><div class="txt">Petal</div><div class="slot">Slot S10</div></div><div class="slot-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Orange%20button%20with%20white%20center%20circle%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%23E67E22%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2211%22%20fill%3D%22%23FFFFFF%22%20stroke%3D%22%23999%22%20stroke-width%3D%221.2%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S10" /></div></div>
        <div class="card"><div class="icon">🍎</div><div><div class="txt">Fruit</div><div class="slot">Slot S5</div></div><div class="slot-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Orange%20button%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%23E67E22%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S5" /></div></div>
        <div class="card"><div class="icon">🌱</div><div><div class="txt">Root</div><div class="slot">Slot S1</div></div><div class="slot-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Red%20button%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%23E74C3C%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S1" /></div></div>
        <div class="card"><div class="icon">🪵</div><div><div class="txt">Bark</div><div class="slot">Slot S8</div></div><div class="slot-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Blue%20button%20with%20white%20center%20circle%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%233498DB%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2211%22%20fill%3D%22%23FFFFFF%22%20stroke%3D%22%23999%22%20stroke-width%3D%221.2%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S8" /></div></div>
        <div class="card"><div class="icon">🌸</div><div><div class="txt">Flower</div><div class="slot">Slot S4</div></div><div class="slot-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Yellow%20button%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%23F1C40F%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S4" /></div></div>
        <div class="card"><div class="icon">🧬</div><div><div class="txt">Vein</div><div class="slot">Slot S9</div></div><div class="slot-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Yellow%20button%20with%20white%20center%20circle%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%23F1C40F%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2211%22%20fill%3D%22%23FFFFFF%22%20stroke%3D%22%23999%22%20stroke-width%3D%221.2%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S9" /></div></div>
        <div class="card"><div class="icon">🍃</div><div><div class="txt">Leaf</div><div class="slot">Slot S3</div></div><div class="slot-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Blue%20button%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%233498DB%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S3" /></div></div>
        <div class="card"><div class="icon">🌰</div><div><div class="txt">Seed</div><div class="slot">Slot S6</div></div><div class="slot-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Red%20button%20with%20white%20center%20circle%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%23E74C3C%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2211%22%20fill%3D%22%23FFFFFF%22%20stroke%3D%22%23999%22%20stroke-width%3D%221.2%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S6" /></div></div>
        <div class="card"><div class="icon">🌿</div><div><div class="txt">Bud</div><div class="slot">Slot S7</div></div><div class="slot-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Green%20button%20with%20white%20center%20circle%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%232ECC71%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2211%22%20fill%3D%22%23FFFFFF%22%20stroke%3D%22%23999%22%20stroke-width%3D%221.2%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S7" /></div></div>
      </div>
      <aside class="right">
        <div class="opt"><div class="oid">R6</div><div>Grows into a new plant</div><div class="ans-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Red%20button%20with%20white%20center%20circle%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%23E74C3C%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2211%22%20fill%3D%22%23FFFFFF%22%20stroke%3D%22%23999%22%20stroke-width%3D%221.2%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S6" /></div></div>
        <div class="opt"><div class="oid">R2</div><div>Supports plant and transports food</div><div class="ans-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Green%20button%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%232ECC71%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S2" /></div></div>
        <div class="opt"><div class="oid">R10</div><div>Attracts pollinators</div><div class="ans-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Orange%20button%20with%20white%20center%20circle%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%23E67E22%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2211%22%20fill%3D%22%23FFFFFF%22%20stroke%3D%22%23999%22%20stroke-width%3D%221.2%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S10" /></div></div>
        <div class="opt"><div class="oid">R1</div><div>Absorbs water and minerals</div><div class="ans-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Red%20button%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%23E74C3C%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S1" /></div></div>
        <div class="opt"><div class="oid">R4</div><div>Reproduction in plants</div><div class="ans-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Yellow%20button%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%23F1C40F%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S4" /></div></div>
        <div class="opt"><div class="oid">R8</div><div>Protects the stem</div><div class="ans-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Blue%20button%20with%20white%20center%20circle%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%233498DB%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2211%22%20fill%3D%22%23FFFFFF%22%20stroke%3D%22%23999%22%20stroke-width%3D%221.2%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S8" /></div></div>
        <div class="opt"><div class="oid">R5</div><div>Protects seeds</div><div class="ans-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Orange%20button%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%23E67E22%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S5" /></div></div>
        <div class="opt"><div class="oid">R3</div><div>Makes food by photosynthesis</div><div class="ans-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Blue%20button%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%233498DB%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S3" /></div></div>
        <div class="opt"><div class="oid">R9</div><div>Carries water and food in leaf</div><div class="ans-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Yellow%20button%20with%20white%20center%20circle%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%23F1C40F%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2211%22%20fill%3D%22%23FFFFFF%22%20stroke%3D%22%23999%22%20stroke-width%3D%221.2%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S9" /></div></div>
        <div class="opt"><div class="oid">R7</div><div>Develops into flower or leaf</div><div class="ans-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Green%20button%20with%20white%20center%20circle%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%232ECC71%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2211%22%20fill%3D%22%23FFFFFF%22%20stroke%3D%22%23999%22%20stroke-width%3D%221.2%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S7" /></div></div>
      </aside>
    </section>
  </article>
</body>
</html>
`,
  },
  {
    id: 'ws_s301_set07_tools_and_uses',
    title: 'Set07 Tools And Uses',
    color: '#f59e0b',
    frontHtml: `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>WS_S301_SET07_TOOLS_AND_USES Front</title>
  <style>
    :root { --w: 794px; --h: 1123px; --line: #666; --head-bg: #d8efcb; --head-border: #80aa75; --panel-bg: #f8f8f4; }
    * { box-sizing: border-box; }
    body { margin: 0; padding: 18px; background: #ecefe8; font-family: "Trebuchet MS", Verdana, sans-serif; }
    .sheet { width: var(--w); height: var(--h); margin: 0 auto; background: #fff; border: 1.4px solid var(--line); position: relative; }
    .header { margin: 10px; border: 1px solid var(--head-border); background: var(--head-bg); padding: 10px 12px; display: grid; grid-template-columns: 1fr auto; gap: 10px; align-items: center; }
    .title { font-size: 15px; font-weight: 700; }
    .meta { font-size: 12px; color: #333; margin-top: 2px; }
    .badge { width: 36px; height: 36px; border-radius: 50%; border: 1px solid var(--line); display: grid; place-items: center; font-weight: 700; background: #f3f3f3; }
    .board { margin: 0 10px 10px; height: calc(100% - 92px); display: grid; grid-template-columns: 1fr 220px; gap: 10px; }
    .left { border: 1px solid var(--line); background: #fff; display: grid; grid-template-columns: 1fr 1fr; gap: 8px; padding: 10px; align-content: start; }
    .card { border: 1px dashed #bbb; border-radius: 6px; padding: 8px; display: grid; grid-template-columns: 44px 1fr auto; gap: 8px; align-items: center; min-height: 88px; }
    .icon { font-size: 30px; text-align: center; }
    .txt { font-size: 14px; font-weight: 700; }
    .slot { font-size: 12px; color: #333; margin-top: 4px; }
    .slot-btn img { width: 28px; height: 28px; display: block; }
    .right { border: 1px solid var(--line); background: var(--panel-bg); display: grid; grid-template-rows: repeat(10, 1fr); }
    .opt { border-bottom: 1px solid var(--line); padding: 6px; display: grid; grid-template-columns: 36px 1fr; gap: 6px; align-items: center; font-size: 13px; }
    .opt:last-child { border-bottom: 0; }
    .oid { font-weight: 700; text-align: center; }
    @media print { body { background: #fff; padding: 0; } .sheet { border: 1px solid #444; } }
  </style>
</head>
<body>
  <article class="sheet">
    <header class="header">
      <div>
        <div class="title">Match each tool with its main use.</div>
        <div class="meta">Worksheet ID: WS_S301_SET07_TOOLS_AND_USES | Structure: LP_FIXED_V1 | Side: Front</div>
      </div>
      <div class="badge">7</div>
    </header>
    <section class="board">
      <div class="left">
        <div class="card"><div class="icon">🌡️</div><div><div class="txt">Thermometer</div><div class="slot">Slot S8</div></div><div class="slot-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Blue%20button%20with%20white%20center%20circle%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%233498DB%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2211%22%20fill%3D%22%23FFFFFF%22%20stroke%3D%22%23999%22%20stroke-width%3D%221.2%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S8" /></div></div>
        <div class="card"><div class="icon">🔨</div><div><div class="txt">Hammer</div><div class="slot">Slot S1</div></div><div class="slot-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Red%20button%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%23E74C3C%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S1" /></div></div>
        <div class="card"><div class="icon">📏</div><div><div class="txt">Ruler</div><div class="slot">Slot S6</div></div><div class="slot-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Red%20button%20with%20white%20center%20circle%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%23E74C3C%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2211%22%20fill%3D%22%23FFFFFF%22%20stroke%3D%22%23999%22%20stroke-width%3D%221.2%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S6" /></div></div>
        <div class="card"><div class="icon">✂️</div><div><div class="txt">Scissors</div><div class="slot">Slot S3</div></div><div class="slot-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Blue%20button%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%233498DB%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S3" /></div></div>
        <div class="card"><div class="icon">🧭</div><div><div class="txt">Compass</div><div class="slot">Slot S9</div></div><div class="slot-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Yellow%20button%20with%20white%20center%20circle%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%23F1C40F%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2211%22%20fill%3D%22%23FFFFFF%22%20stroke%3D%22%23999%22%20stroke-width%3D%221.2%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S9" /></div></div>
        <div class="card"><div class="icon">🖌️</div><div><div class="txt">Paint Brush</div><div class="slot">Slot S5</div></div><div class="slot-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Orange%20button%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%23E67E22%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S5" /></div></div>
        <div class="card"><div class="icon">🪛</div><div><div class="txt">Screwdriver</div><div class="slot">Slot S2</div></div><div class="slot-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Green%20button%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%232ECC71%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S2" /></div></div>
        <div class="card"><div class="icon">🧴</div><div><div class="txt">Glue Gun</div><div class="slot">Slot S10</div></div><div class="slot-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Orange%20button%20with%20white%20center%20circle%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%23E67E22%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2211%22%20fill%3D%22%23FFFFFF%22%20stroke%3D%22%23999%22%20stroke-width%3D%221.2%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S10" /></div></div>
        <div class="card"><div class="icon">🔍</div><div><div class="txt">Magnifying Glass</div><div class="slot">Slot S7</div></div><div class="slot-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Green%20button%20with%20white%20center%20circle%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%232ECC71%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2211%22%20fill%3D%22%23FFFFFF%22%20stroke%3D%22%23999%22%20stroke-width%3D%221.2%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S7" /></div></div>
        <div class="card"><div class="icon">🔧</div><div><div class="txt">Spanner</div><div class="slot">Slot S4</div></div><div class="slot-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Yellow%20button%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%23F1C40F%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S4" /></div></div>
      </div>
      <aside class="right">
        <div class="opt"><div class="oid">R5</div><div>Applies paint</div></div>
        <div class="opt"><div class="oid">R9</div><div>Draws circles</div></div>
        <div class="opt"><div class="oid">R2</div><div>Tightens screws</div></div>
        <div class="opt"><div class="oid">R8</div><div>Measures temperature</div></div>
        <div class="opt"><div class="oid">R6</div><div>Measures length</div></div>
        <div class="opt"><div class="oid">R3</div><div>Cuts paper or cloth</div></div>
        <div class="opt"><div class="oid">R10</div><div>Joins materials with hot glue</div></div>
        <div class="opt"><div class="oid">R1</div><div>Drives nails</div></div>
        <div class="opt"><div class="oid">R4</div><div>Tightens nuts and bolts</div></div>
        <div class="opt"><div class="oid">R7</div><div>Enlarges small objects</div></div>
      </aside>
    </section>
  </article>
</body>
</html>
`,
    backHtml: `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>WS_S301_SET07_TOOLS_AND_USES Flip</title>
  <style>
    :root { --w: 794px; --h: 1123px; --line: #666; --head-bg: #feeec9; --head-border: #b28d44; --panel-bg: #faf7ef; }
    * { box-sizing: border-box; }
    body { margin: 0; padding: 18px; background: #ecefe8; font-family: "Trebuchet MS", Verdana, sans-serif; }
    .sheet { width: var(--w); height: var(--h); margin: 0 auto; background: #fff; border: 1.4px solid var(--line); position: relative; }
    .header { margin: 10px; border: 1px solid var(--head-border); background: var(--head-bg); padding: 10px 12px; display: grid; grid-template-columns: 1fr auto; gap: 10px; align-items: center; }
    .title { font-size: 15px; font-weight: 700; }
    .meta { font-size: 12px; color: #333; margin-top: 2px; }
    .badge { width: 36px; height: 36px; border-radius: 50%; border: 1px solid var(--line); display: grid; place-items: center; font-weight: 700; background: #f3f3f3; }
    .board { margin: 0 10px 10px; height: calc(100% - 92px); display: grid; grid-template-columns: 1fr 220px; gap: 10px; }
    .left { border: 1px solid var(--line); background: #fff; display: grid; grid-template-columns: 1fr 1fr; gap: 8px; padding: 10px; align-content: start; }
    .card { border: 1px dashed #bbb; border-radius: 6px; padding: 8px; display: grid; grid-template-columns: 44px 1fr auto; gap: 8px; align-items: center; min-height: 88px; }
    .icon { font-size: 30px; text-align: center; }
    .txt { font-size: 14px; font-weight: 700; }
    .slot { font-size: 12px; color: #333; margin-top: 4px; }
    .slot-btn img { width: 28px; height: 28px; display: block; }
    .right { border: 1px solid var(--line); background: var(--panel-bg); display: grid; grid-template-rows: repeat(10, 1fr); }
    .opt { border-bottom: 1px solid var(--line); padding: 6px; display: grid; grid-template-columns: 34px 1fr auto; gap: 6px; align-items: center; font-size: 13px; }
    .opt:last-child { border-bottom: 0; }
    .oid { font-weight: 700; text-align: center; }
    .ans-btn img { width: 24px; height: 24px; display: block; }
    @media print { body { background: #fff; padding: 0; } .sheet { border: 1px solid #444; } }
  </style>
</head>
<body>
  <article class="sheet">
    <header class="header">
      <div>
        <div class="title">Answer Side: Match your front attempt with the correct button next to each option.</div>
        <div class="meta">Worksheet ID: WS_S301_SET07_TOOLS_AND_USES | Structure: LP_FIXED_V1 | Side: Flip</div>
      </div>
      <div class="badge">7</div>
    </header>
    <section class="board">
      <div class="left">
        <div class="card"><div class="icon">🌡️</div><div><div class="txt">Thermometer</div><div class="slot">Slot S8</div></div><div class="slot-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Blue%20button%20with%20white%20center%20circle%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%233498DB%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2211%22%20fill%3D%22%23FFFFFF%22%20stroke%3D%22%23999%22%20stroke-width%3D%221.2%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S8" /></div></div>
        <div class="card"><div class="icon">🔨</div><div><div class="txt">Hammer</div><div class="slot">Slot S1</div></div><div class="slot-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Red%20button%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%23E74C3C%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S1" /></div></div>
        <div class="card"><div class="icon">📏</div><div><div class="txt">Ruler</div><div class="slot">Slot S6</div></div><div class="slot-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Red%20button%20with%20white%20center%20circle%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%23E74C3C%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2211%22%20fill%3D%22%23FFFFFF%22%20stroke%3D%22%23999%22%20stroke-width%3D%221.2%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S6" /></div></div>
        <div class="card"><div class="icon">✂️</div><div><div class="txt">Scissors</div><div class="slot">Slot S3</div></div><div class="slot-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Blue%20button%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%233498DB%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S3" /></div></div>
        <div class="card"><div class="icon">🧭</div><div><div class="txt">Compass</div><div class="slot">Slot S9</div></div><div class="slot-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Yellow%20button%20with%20white%20center%20circle%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%23F1C40F%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2211%22%20fill%3D%22%23FFFFFF%22%20stroke%3D%22%23999%22%20stroke-width%3D%221.2%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S9" /></div></div>
        <div class="card"><div class="icon">🖌️</div><div><div class="txt">Paint Brush</div><div class="slot">Slot S5</div></div><div class="slot-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Orange%20button%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%23E67E22%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S5" /></div></div>
        <div class="card"><div class="icon">🪛</div><div><div class="txt">Screwdriver</div><div class="slot">Slot S2</div></div><div class="slot-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Green%20button%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%232ECC71%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S2" /></div></div>
        <div class="card"><div class="icon">🧴</div><div><div class="txt">Glue Gun</div><div class="slot">Slot S10</div></div><div class="slot-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Orange%20button%20with%20white%20center%20circle%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%23E67E22%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2211%22%20fill%3D%22%23FFFFFF%22%20stroke%3D%22%23999%22%20stroke-width%3D%221.2%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S10" /></div></div>
        <div class="card"><div class="icon">🔍</div><div><div class="txt">Magnifying Glass</div><div class="slot">Slot S7</div></div><div class="slot-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Green%20button%20with%20white%20center%20circle%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%232ECC71%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2211%22%20fill%3D%22%23FFFFFF%22%20stroke%3D%22%23999%22%20stroke-width%3D%221.2%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S7" /></div></div>
        <div class="card"><div class="icon">🔧</div><div><div class="txt">Spanner</div><div class="slot">Slot S4</div></div><div class="slot-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Yellow%20button%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%23F1C40F%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S4" /></div></div>
      </div>
      <aside class="right">
        <div class="opt"><div class="oid">R5</div><div>Applies paint</div><div class="ans-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Orange%20button%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%23E67E22%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S5" /></div></div>
        <div class="opt"><div class="oid">R9</div><div>Draws circles</div><div class="ans-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Yellow%20button%20with%20white%20center%20circle%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%23F1C40F%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2211%22%20fill%3D%22%23FFFFFF%22%20stroke%3D%22%23999%22%20stroke-width%3D%221.2%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S9" /></div></div>
        <div class="opt"><div class="oid">R2</div><div>Tightens screws</div><div class="ans-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Green%20button%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%232ECC71%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S2" /></div></div>
        <div class="opt"><div class="oid">R8</div><div>Measures temperature</div><div class="ans-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Blue%20button%20with%20white%20center%20circle%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%233498DB%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2211%22%20fill%3D%22%23FFFFFF%22%20stroke%3D%22%23999%22%20stroke-width%3D%221.2%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S8" /></div></div>
        <div class="opt"><div class="oid">R6</div><div>Measures length</div><div class="ans-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Red%20button%20with%20white%20center%20circle%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%23E74C3C%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2211%22%20fill%3D%22%23FFFFFF%22%20stroke%3D%22%23999%22%20stroke-width%3D%221.2%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S6" /></div></div>
        <div class="opt"><div class="oid">R3</div><div>Cuts paper or cloth</div><div class="ans-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Blue%20button%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%233498DB%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S3" /></div></div>
        <div class="opt"><div class="oid">R10</div><div>Joins materials with hot glue</div><div class="ans-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Orange%20button%20with%20white%20center%20circle%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%23E67E22%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2211%22%20fill%3D%22%23FFFFFF%22%20stroke%3D%22%23999%22%20stroke-width%3D%221.2%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S10" /></div></div>
        <div class="opt"><div class="oid">R1</div><div>Drives nails</div><div class="ans-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Red%20button%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%23E74C3C%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S1" /></div></div>
        <div class="opt"><div class="oid">R4</div><div>Tightens nuts and bolts</div><div class="ans-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Yellow%20button%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%23F1C40F%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S4" /></div></div>
        <div class="opt"><div class="oid">R7</div><div>Enlarges small objects</div><div class="ans-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Green%20button%20with%20white%20center%20circle%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%232ECC71%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2211%22%20fill%3D%22%23FFFFFF%22%20stroke%3D%22%23999%22%20stroke-width%3D%221.2%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S7" /></div></div>
      </aside>
    </section>
  </article>
</body>
</html>
`,
  },
  {
    id: 'ws_s301_set11_plant_parts_basics',
    title: 'Set11 Plant Parts Basics',
    color: '#16a34a',
    frontHtml: `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>WS_S301_SET11_PLANT_PARTS_BASICS Front</title>
  <style>
    :root { --w: 794px; --h: 1123px; --line: #666; --head-bg: #d8efcb; --head-border: #80aa75; --panel-bg: #f8f8f4; }
    * { box-sizing: border-box; }
    body { margin: 0; padding: 18px; background: #ecefe8; font-family: "Trebuchet MS", Verdana, sans-serif; }
    .sheet { width: var(--w); height: var(--h); margin: 0 auto; background: #fff; border: 1.4px solid var(--line); position: relative; }
    .header { margin: 10px; border: 1px solid var(--head-border); background: var(--head-bg); padding: 10px 12px; display: grid; grid-template-columns: 1fr auto; gap: 10px; align-items: center; }
    .title { font-size: 15px; font-weight: 700; }
    .meta { font-size: 12px; color: #333; margin-top: 2px; }
    .badge { width: 36px; height: 36px; border-radius: 50%; border: 1px solid var(--line); display: grid; place-items: center; font-weight: 700; background: #f3f3f3; }
    .board { margin: 0 10px 10px; height: calc(100% - 92px); display: grid; grid-template-columns: 1fr 220px; gap: 10px; }
    .left { border: 1px solid var(--line); background: #fff; display: grid; grid-template-columns: 1fr 1fr; gap: 8px; padding: 10px; align-content: start; }
    .card { border: 1px dashed #bbb; border-radius: 6px; padding: 8px; display: grid; grid-template-columns: 44px 1fr auto; gap: 8px; align-items: center; min-height: 88px; }
    .icon { font-size: 30px; text-align: center; }
    .txt { font-size: 14px; font-weight: 700; }
    .slot { font-size: 12px; color: #333; margin-top: 4px; }
    .slot-btn img { width: 28px; height: 28px; display: block; }
    .right { border: 1px solid var(--line); background: var(--panel-bg); display: grid; grid-template-rows: repeat(10, 1fr); }
    .opt { border-bottom: 1px solid var(--line); padding: 6px; display: grid; grid-template-columns: 36px 1fr; gap: 6px; align-items: center; font-size: 13px; }
    .opt:last-child { border-bottom: 0; }
    .oid { font-weight: 700; text-align: center; }
    @media print { body { background: #fff; padding: 0; } .sheet { border: 1px solid #444; } }
  </style>
</head>
<body>
  <article class="sheet">
    <header class="header">
      <div>
        <div class="title">Match each plant part identification with the correct answer.</div>
        <div class="meta">Worksheet ID: WS_S301_SET11_PLANT_PARTS_BASICS | Structure: LP_FIXED_V1 | Side: Front</div>
      </div>
      <div class="badge">11</div>
    </header>
    <section class="board">
      <div class="left">
        <div class="card"><div class="icon">🍃</div><div><div class="txt">Leaf</div><div class="slot">Slot S3</div></div><div class="slot-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Blue%20button%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%233498DB%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S3" /></div></div>
        <div class="card"><div class="icon">🧬</div><div><div class="txt">Vein</div><div class="slot">Slot S9</div></div><div class="slot-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Yellow%20button%20with%20white%20center%20circle%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%23F1C40F%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2211%22%20fill%3D%22%23FFFFFF%22%20stroke%3D%22%23999%22%20stroke-width%3D%221.2%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S9" /></div></div>
        <div class="card"><div class="icon">🌸</div><div><div class="txt">Flower</div><div class="slot">Slot S4</div></div><div class="slot-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Yellow%20button%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%23F1C40F%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S4" /></div></div>
        <div class="card"><div class="icon">🍎</div><div><div class="txt">Fruit</div><div class="slot">Slot S5</div></div><div class="slot-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Orange%20button%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%23E67E22%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S5" /></div></div>
        <div class="card"><div class="icon">🌱</div><div><div class="txt">Root</div><div class="slot">Slot S1</div></div><div class="slot-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Red%20button%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%23E74C3C%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S1" /></div></div>
        <div class="card"><div class="icon">🪴</div><div><div class="txt">Stem</div><div class="slot">Slot S2</div></div><div class="slot-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Green%20button%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%232ECC71%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S2" /></div></div>
        <div class="card"><div class="icon">🌿</div><div><div class="txt">Bud</div><div class="slot">Slot S7</div></div><div class="slot-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Green%20button%20with%20white%20center%20circle%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%232ECC71%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2211%22%20fill%3D%22%23FFFFFF%22%20stroke%3D%22%23999%22%20stroke-width%3D%221.2%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S7" /></div></div>
        <div class="card"><div class="icon">🌺</div><div><div class="txt">Petal</div><div class="slot">Slot S10</div></div><div class="slot-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Orange%20button%20with%20white%20center%20circle%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%23E67E22%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2211%22%20fill%3D%22%23FFFFFF%22%20stroke%3D%22%23999%22%20stroke-width%3D%221.2%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S10" /></div></div>
        <div class="card"><div class="icon">🌰</div><div><div class="txt">Seed</div><div class="slot">Slot S6</div></div><div class="slot-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Red%20button%20with%20white%20center%20circle%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%23E74C3C%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2211%22%20fill%3D%22%23FFFFFF%22%20stroke%3D%22%23999%22%20stroke-width%3D%221.2%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S6" /></div></div>
        <div class="card"><div class="icon">🪵</div><div><div class="txt">Bark</div><div class="slot">Slot S8</div></div><div class="slot-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Blue%20button%20with%20white%20center%20circle%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%233498DB%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2211%22%20fill%3D%22%23FFFFFF%22%20stroke%3D%22%23999%22%20stroke-width%3D%221.2%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S8" /></div></div>
      </div>
      <aside class="right">
        <div class="opt"><div class="oid">R8</div><div>Protects the stem</div></div>
        <div class="opt"><div class="oid">R10</div><div>Attracts pollinators</div></div>
        <div class="opt"><div class="oid">R3</div><div>Makes food by photosynthesis</div></div>
        <div class="opt"><div class="oid">R4</div><div>Reproduction in plants</div></div>
        <div class="opt"><div class="oid">R9</div><div>Carries water and food in leaf</div></div>
        <div class="opt"><div class="oid">R7</div><div>Develops into flower or leaf</div></div>
        <div class="opt"><div class="oid">R6</div><div>Grows into a new plant</div></div>
        <div class="opt"><div class="oid">R2</div><div>Supports plant and transports food</div></div>
        <div class="opt"><div class="oid">R1</div><div>Absorbs water and minerals</div></div>
        <div class="opt"><div class="oid">R5</div><div>Protects seeds</div></div>
      </aside>
    </section>
  </article>
</body>
</html>
`,
    backHtml: `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>WS_S301_SET11_PLANT_PARTS_BASICS Flip</title>
  <style>
    :root { --w: 794px; --h: 1123px; --line: #666; --head-bg: #feeec9; --head-border: #b28d44; --panel-bg: #faf7ef; }
    * { box-sizing: border-box; }
    body { margin: 0; padding: 18px; background: #ecefe8; font-family: "Trebuchet MS", Verdana, sans-serif; }
    .sheet { width: var(--w); height: var(--h); margin: 0 auto; background: #fff; border: 1.4px solid var(--line); position: relative; }
    .header { margin: 10px; border: 1px solid var(--head-border); background: var(--head-bg); padding: 10px 12px; display: grid; grid-template-columns: 1fr auto; gap: 10px; align-items: center; }
    .title { font-size: 15px; font-weight: 700; }
    .meta { font-size: 12px; color: #333; margin-top: 2px; }
    .badge { width: 36px; height: 36px; border-radius: 50%; border: 1px solid var(--line); display: grid; place-items: center; font-weight: 700; background: #f3f3f3; }
    .board { margin: 0 10px 10px; height: calc(100% - 92px); display: grid; grid-template-columns: 1fr 220px; gap: 10px; }
    .left { border: 1px solid var(--line); background: #fff; display: grid; grid-template-columns: 1fr 1fr; gap: 8px; padding: 10px; align-content: start; }
    .card { border: 1px dashed #bbb; border-radius: 6px; padding: 8px; display: grid; grid-template-columns: 44px 1fr auto; gap: 8px; align-items: center; min-height: 88px; }
    .icon { font-size: 30px; text-align: center; }
    .txt { font-size: 14px; font-weight: 700; }
    .slot { font-size: 12px; color: #333; margin-top: 4px; }
    .slot-btn img { width: 28px; height: 28px; display: block; }
    .right { border: 1px solid var(--line); background: var(--panel-bg); display: grid; grid-template-rows: repeat(10, 1fr); }
    .opt { border-bottom: 1px solid var(--line); padding: 6px; display: grid; grid-template-columns: 34px 1fr auto; gap: 6px; align-items: center; font-size: 13px; }
    .opt:last-child { border-bottom: 0; }
    .oid { font-weight: 700; text-align: center; }
    .ans-btn img { width: 24px; height: 24px; display: block; }
    @media print { body { background: #fff; padding: 0; } .sheet { border: 1px solid #444; } }
  </style>
</head>
<body>
  <article class="sheet">
    <header class="header">
      <div>
        <div class="title">Answer Side: Match your front attempt with the correct button next to each option.</div>
        <div class="meta">Worksheet ID: WS_S301_SET11_PLANT_PARTS_BASICS | Structure: LP_FIXED_V1 | Side: Flip</div>
      </div>
      <div class="badge">11</div>
    </header>
    <section class="board">
      <div class="left">
        <div class="card"><div class="icon">🍃</div><div><div class="txt">Leaf</div><div class="slot">Slot S3</div></div><div class="slot-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Blue%20button%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%233498DB%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S3" /></div></div>
        <div class="card"><div class="icon">🧬</div><div><div class="txt">Vein</div><div class="slot">Slot S9</div></div><div class="slot-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Yellow%20button%20with%20white%20center%20circle%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%23F1C40F%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2211%22%20fill%3D%22%23FFFFFF%22%20stroke%3D%22%23999%22%20stroke-width%3D%221.2%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S9" /></div></div>
        <div class="card"><div class="icon">🌸</div><div><div class="txt">Flower</div><div class="slot">Slot S4</div></div><div class="slot-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Yellow%20button%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%23F1C40F%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S4" /></div></div>
        <div class="card"><div class="icon">🍎</div><div><div class="txt">Fruit</div><div class="slot">Slot S5</div></div><div class="slot-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Orange%20button%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%23E67E22%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S5" /></div></div>
        <div class="card"><div class="icon">🌱</div><div><div class="txt">Root</div><div class="slot">Slot S1</div></div><div class="slot-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Red%20button%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%23E74C3C%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S1" /></div></div>
        <div class="card"><div class="icon">🪴</div><div><div class="txt">Stem</div><div class="slot">Slot S2</div></div><div class="slot-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Green%20button%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%232ECC71%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S2" /></div></div>
        <div class="card"><div class="icon">🌿</div><div><div class="txt">Bud</div><div class="slot">Slot S7</div></div><div class="slot-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Green%20button%20with%20white%20center%20circle%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%232ECC71%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2211%22%20fill%3D%22%23FFFFFF%22%20stroke%3D%22%23999%22%20stroke-width%3D%221.2%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S7" /></div></div>
        <div class="card"><div class="icon">🌺</div><div><div class="txt">Petal</div><div class="slot">Slot S10</div></div><div class="slot-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Orange%20button%20with%20white%20center%20circle%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%23E67E22%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2211%22%20fill%3D%22%23FFFFFF%22%20stroke%3D%22%23999%22%20stroke-width%3D%221.2%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S10" /></div></div>
        <div class="card"><div class="icon">🌰</div><div><div class="txt">Seed</div><div class="slot">Slot S6</div></div><div class="slot-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Red%20button%20with%20white%20center%20circle%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%23E74C3C%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2211%22%20fill%3D%22%23FFFFFF%22%20stroke%3D%22%23999%22%20stroke-width%3D%221.2%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S6" /></div></div>
        <div class="card"><div class="icon">🪵</div><div><div class="txt">Bark</div><div class="slot">Slot S8</div></div><div class="slot-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Blue%20button%20with%20white%20center%20circle%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%233498DB%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2211%22%20fill%3D%22%23FFFFFF%22%20stroke%3D%22%23999%22%20stroke-width%3D%221.2%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S8" /></div></div>
      </div>
      <aside class="right">
        <div class="opt"><div class="oid">R8</div><div>Protects the stem</div><div class="ans-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Blue%20button%20with%20white%20center%20circle%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%233498DB%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2211%22%20fill%3D%22%23FFFFFF%22%20stroke%3D%22%23999%22%20stroke-width%3D%221.2%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S8" /></div></div>
        <div class="opt"><div class="oid">R10</div><div>Attracts pollinators</div><div class="ans-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Orange%20button%20with%20white%20center%20circle%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%23E67E22%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2211%22%20fill%3D%22%23FFFFFF%22%20stroke%3D%22%23999%22%20stroke-width%3D%221.2%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S10" /></div></div>
        <div class="opt"><div class="oid">R3</div><div>Makes food by photosynthesis</div><div class="ans-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Blue%20button%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%233498DB%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S3" /></div></div>
        <div class="opt"><div class="oid">R4</div><div>Reproduction in plants</div><div class="ans-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Yellow%20button%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%23F1C40F%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S4" /></div></div>
        <div class="opt"><div class="oid">R9</div><div>Carries water and food in leaf</div><div class="ans-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Yellow%20button%20with%20white%20center%20circle%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%23F1C40F%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2211%22%20fill%3D%22%23FFFFFF%22%20stroke%3D%22%23999%22%20stroke-width%3D%221.2%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S9" /></div></div>
        <div class="opt"><div class="oid">R7</div><div>Develops into flower or leaf</div><div class="ans-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Green%20button%20with%20white%20center%20circle%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%232ECC71%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2211%22%20fill%3D%22%23FFFFFF%22%20stroke%3D%22%23999%22%20stroke-width%3D%221.2%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S7" /></div></div>
        <div class="opt"><div class="oid">R6</div><div>Grows into a new plant</div><div class="ans-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Red%20button%20with%20white%20center%20circle%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%23E74C3C%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2211%22%20fill%3D%22%23FFFFFF%22%20stroke%3D%22%23999%22%20stroke-width%3D%221.2%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S6" /></div></div>
        <div class="opt"><div class="oid">R2</div><div>Supports plant and transports food</div><div class="ans-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Green%20button%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%232ECC71%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S2" /></div></div>
        <div class="opt"><div class="oid">R1</div><div>Absorbs water and minerals</div><div class="ans-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Red%20button%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%23E74C3C%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S1" /></div></div>
        <div class="opt"><div class="oid">R5</div><div>Protects seeds</div><div class="ans-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Orange%20button%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%23E67E22%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S5" /></div></div>
      </aside>
    </section>
  </article>
</body>
</html>
`,
  },
  {
    id: 'ws_s301_set12_plant_parts_functions',
    title: 'Set12 Plant Parts Functions',
    color: '#f59e0b',
    frontHtml: `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>WS_S301_SET12_PLANT_PARTS_FUNCTIONS Front</title>
  <style>
    :root { --w: 794px; --h: 1123px; --line: #666; --head-bg: #d8efcb; --head-border: #80aa75; --panel-bg: #f8f8f4; }
    * { box-sizing: border-box; }
    body { margin: 0; padding: 18px; background: #ecefe8; font-family: "Trebuchet MS", Verdana, sans-serif; }
    .sheet { width: var(--w); height: var(--h); margin: 0 auto; background: #fff; border: 1.4px solid var(--line); position: relative; }
    .header { margin: 10px; border: 1px solid var(--head-border); background: var(--head-bg); padding: 10px 12px; display: grid; grid-template-columns: 1fr auto; gap: 10px; align-items: center; }
    .title { font-size: 15px; font-weight: 700; }
    .meta { font-size: 12px; color: #333; margin-top: 2px; }
    .badge { width: 36px; height: 36px; border-radius: 50%; border: 1px solid var(--line); display: grid; place-items: center; font-weight: 700; background: #f3f3f3; }
    .board { margin: 0 10px 10px; height: calc(100% - 92px); display: grid; grid-template-columns: 1fr 220px; gap: 10px; }
    .left { border: 1px solid var(--line); background: #fff; display: grid; grid-template-columns: 1fr 1fr; gap: 8px; padding: 10px; align-content: start; }
    .card { border: 1px dashed #bbb; border-radius: 6px; padding: 8px; display: grid; grid-template-columns: 44px 1fr auto; gap: 8px; align-items: center; min-height: 88px; }
    .icon { font-size: 30px; text-align: center; }
    .txt { font-size: 14px; font-weight: 700; }
    .slot { font-size: 12px; color: #333; margin-top: 4px; }
    .slot-btn img { width: 28px; height: 28px; display: block; }
    .right { border: 1px solid var(--line); background: var(--panel-bg); display: grid; grid-template-rows: repeat(10, 1fr); }
    .opt { border-bottom: 1px solid var(--line); padding: 6px; display: grid; grid-template-columns: 36px 1fr; gap: 6px; align-items: center; font-size: 13px; }
    .opt:last-child { border-bottom: 0; }
    .oid { font-weight: 700; text-align: center; }
    @media print { body { background: #fff; padding: 0; } .sheet { border: 1px solid #444; } }
  </style>
</head>
<body>
  <article class="sheet">
    <header class="header">
      <div>
        <div class="title">Match each plant functions with the correct answer.</div>
        <div class="meta">Worksheet ID: WS_S301_SET12_PLANT_PARTS_FUNCTIONS | Structure: LP_FIXED_V1 | Side: Front</div>
      </div>
      <div class="badge">12</div>
    </header>
    <section class="board">
      <div class="left">
        <div class="card"><div class="icon">🌸</div><div><div class="txt">Flower</div><div class="slot">Slot S4</div></div><div class="slot-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Yellow%20button%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%23F1C40F%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S4" /></div></div>
        <div class="card"><div class="icon">🌱</div><div><div class="txt">Root</div><div class="slot">Slot S1</div></div><div class="slot-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Red%20button%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%23E74C3C%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S1" /></div></div>
        <div class="card"><div class="icon">🌿</div><div><div class="txt">Bud</div><div class="slot">Slot S7</div></div><div class="slot-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Green%20button%20with%20white%20center%20circle%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%232ECC71%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2211%22%20fill%3D%22%23FFFFFF%22%20stroke%3D%22%23999%22%20stroke-width%3D%221.2%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S7" /></div></div>
        <div class="card"><div class="icon">🪴</div><div><div class="txt">Stem</div><div class="slot">Slot S2</div></div><div class="slot-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Green%20button%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%232ECC71%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S2" /></div></div>
        <div class="card"><div class="icon">🌼</div><div><div class="txt">Sepal</div><div class="slot">Slot S10</div></div><div class="slot-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Orange%20button%20with%20white%20center%20circle%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%23E67E22%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2211%22%20fill%3D%22%23FFFFFF%22%20stroke%3D%22%23999%22%20stroke-width%3D%221.2%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S10" /></div></div>
        <div class="card"><div class="icon">🌰</div><div><div class="txt">Seed</div><div class="slot">Slot S6</div></div><div class="slot-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Red%20button%20with%20white%20center%20circle%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%23E74C3C%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2211%22%20fill%3D%22%23FFFFFF%22%20stroke%3D%22%23999%22%20stroke-width%3D%221.2%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S6" /></div></div>
        <div class="card"><div class="icon">🍃</div><div><div class="txt">Leaf</div><div class="slot">Slot S3</div></div><div class="slot-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Blue%20button%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%233498DB%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S3" /></div></div>
        <div class="card"><div class="icon">🪵</div><div><div class="txt">Bark</div><div class="slot">Slot S8</div></div><div class="slot-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Blue%20button%20with%20white%20center%20circle%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%233498DB%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2211%22%20fill%3D%22%23FFFFFF%22%20stroke%3D%22%23999%22%20stroke-width%3D%221.2%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S8" /></div></div>
        <div class="card"><div class="icon">🍎</div><div><div class="txt">Fruit</div><div class="slot">Slot S5</div></div><div class="slot-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Orange%20button%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%23E67E22%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S5" /></div></div>
        <div class="card"><div class="icon">🧬</div><div><div class="txt">Vein</div><div class="slot">Slot S9</div></div><div class="slot-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Yellow%20button%20with%20white%20center%20circle%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%23F1C40F%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2211%22%20fill%3D%22%23FFFFFF%22%20stroke%3D%22%23999%22%20stroke-width%3D%221.2%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S9" /></div></div>
      </div>
      <aside class="right">
        <div class="opt"><div class="oid">R1</div><div>Absorbs water and minerals</div></div>
        <div class="opt"><div class="oid">R10</div><div>Protects the flower bud</div></div>
        <div class="opt"><div class="oid">R4</div><div>Reproduction in plants</div></div>
        <div class="opt"><div class="oid">R5</div><div>Protects seeds</div></div>
        <div class="opt"><div class="oid">R3</div><div>Makes food by photosynthesis</div></div>
        <div class="opt"><div class="oid">R8</div><div>Protects the stem</div></div>
        <div class="opt"><div class="oid">R6</div><div>Grows into a new plant</div></div>
        <div class="opt"><div class="oid">R7</div><div>Develops into flower or leaf</div></div>
        <div class="opt"><div class="oid">R9</div><div>Carries water and food in leaf</div></div>
        <div class="opt"><div class="oid">R2</div><div>Supports plant and transports food</div></div>
      </aside>
    </section>
  </article>
</body>
</html>
`,
    backHtml: `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>WS_S301_SET12_PLANT_PARTS_FUNCTIONS Flip</title>
  <style>
    :root { --w: 794px; --h: 1123px; --line: #666; --head-bg: #feeec9; --head-border: #b28d44; --panel-bg: #faf7ef; }
    * { box-sizing: border-box; }
    body { margin: 0; padding: 18px; background: #ecefe8; font-family: "Trebuchet MS", Verdana, sans-serif; }
    .sheet { width: var(--w); height: var(--h); margin: 0 auto; background: #fff; border: 1.4px solid var(--line); position: relative; }
    .header { margin: 10px; border: 1px solid var(--head-border); background: var(--head-bg); padding: 10px 12px; display: grid; grid-template-columns: 1fr auto; gap: 10px; align-items: center; }
    .title { font-size: 15px; font-weight: 700; }
    .meta { font-size: 12px; color: #333; margin-top: 2px; }
    .badge { width: 36px; height: 36px; border-radius: 50%; border: 1px solid var(--line); display: grid; place-items: center; font-weight: 700; background: #f3f3f3; }
    .board { margin: 0 10px 10px; height: calc(100% - 92px); display: grid; grid-template-columns: 1fr 220px; gap: 10px; }
    .left { border: 1px solid var(--line); background: #fff; display: grid; grid-template-columns: 1fr 1fr; gap: 8px; padding: 10px; align-content: start; }
    .card { border: 1px dashed #bbb; border-radius: 6px; padding: 8px; display: grid; grid-template-columns: 44px 1fr auto; gap: 8px; align-items: center; min-height: 88px; }
    .icon { font-size: 30px; text-align: center; }
    .txt { font-size: 14px; font-weight: 700; }
    .slot { font-size: 12px; color: #333; margin-top: 4px; }
    .slot-btn img { width: 28px; height: 28px; display: block; }
    .right { border: 1px solid var(--line); background: var(--panel-bg); display: grid; grid-template-rows: repeat(10, 1fr); }
    .opt { border-bottom: 1px solid var(--line); padding: 6px; display: grid; grid-template-columns: 34px 1fr auto; gap: 6px; align-items: center; font-size: 13px; }
    .opt:last-child { border-bottom: 0; }
    .oid { font-weight: 700; text-align: center; }
    .ans-btn img { width: 24px; height: 24px; display: block; }
    @media print { body { background: #fff; padding: 0; } .sheet { border: 1px solid #444; } }
  </style>
</head>
<body>
  <article class="sheet">
    <header class="header">
      <div>
        <div class="title">Answer Side: Match your front attempt with the correct button next to each option.</div>
        <div class="meta">Worksheet ID: WS_S301_SET12_PLANT_PARTS_FUNCTIONS | Structure: LP_FIXED_V1 | Side: Flip</div>
      </div>
      <div class="badge">12</div>
    </header>
    <section class="board">
      <div class="left">
        <div class="card"><div class="icon">🌸</div><div><div class="txt">Flower</div><div class="slot">Slot S4</div></div><div class="slot-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Yellow%20button%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%23F1C40F%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S4" /></div></div>
        <div class="card"><div class="icon">🌱</div><div><div class="txt">Root</div><div class="slot">Slot S1</div></div><div class="slot-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Red%20button%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%23E74C3C%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S1" /></div></div>
        <div class="card"><div class="icon">🌿</div><div><div class="txt">Bud</div><div class="slot">Slot S7</div></div><div class="slot-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Green%20button%20with%20white%20center%20circle%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%232ECC71%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2211%22%20fill%3D%22%23FFFFFF%22%20stroke%3D%22%23999%22%20stroke-width%3D%221.2%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S7" /></div></div>
        <div class="card"><div class="icon">🪴</div><div><div class="txt">Stem</div><div class="slot">Slot S2</div></div><div class="slot-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Green%20button%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%232ECC71%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S2" /></div></div>
        <div class="card"><div class="icon">🌼</div><div><div class="txt">Sepal</div><div class="slot">Slot S10</div></div><div class="slot-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Orange%20button%20with%20white%20center%20circle%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%23E67E22%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2211%22%20fill%3D%22%23FFFFFF%22%20stroke%3D%22%23999%22%20stroke-width%3D%221.2%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S10" /></div></div>
        <div class="card"><div class="icon">🌰</div><div><div class="txt">Seed</div><div class="slot">Slot S6</div></div><div class="slot-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Red%20button%20with%20white%20center%20circle%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%23E74C3C%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2211%22%20fill%3D%22%23FFFFFF%22%20stroke%3D%22%23999%22%20stroke-width%3D%221.2%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S6" /></div></div>
        <div class="card"><div class="icon">🍃</div><div><div class="txt">Leaf</div><div class="slot">Slot S3</div></div><div class="slot-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Blue%20button%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%233498DB%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S3" /></div></div>
        <div class="card"><div class="icon">🪵</div><div><div class="txt">Bark</div><div class="slot">Slot S8</div></div><div class="slot-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Blue%20button%20with%20white%20center%20circle%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%233498DB%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2211%22%20fill%3D%22%23FFFFFF%22%20stroke%3D%22%23999%22%20stroke-width%3D%221.2%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S8" /></div></div>
        <div class="card"><div class="icon">🍎</div><div><div class="txt">Fruit</div><div class="slot">Slot S5</div></div><div class="slot-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Orange%20button%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%23E67E22%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S5" /></div></div>
        <div class="card"><div class="icon">🧬</div><div><div class="txt">Vein</div><div class="slot">Slot S9</div></div><div class="slot-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Yellow%20button%20with%20white%20center%20circle%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%23F1C40F%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2211%22%20fill%3D%22%23FFFFFF%22%20stroke%3D%22%23999%22%20stroke-width%3D%221.2%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S9" /></div></div>
      </div>
      <aside class="right">
        <div class="opt"><div class="oid">R1</div><div>Absorbs water and minerals</div><div class="ans-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Red%20button%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%23E74C3C%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S1" /></div></div>
        <div class="opt"><div class="oid">R10</div><div>Protects the flower bud</div><div class="ans-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Orange%20button%20with%20white%20center%20circle%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%23E67E22%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2211%22%20fill%3D%22%23FFFFFF%22%20stroke%3D%22%23999%22%20stroke-width%3D%221.2%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S10" /></div></div>
        <div class="opt"><div class="oid">R4</div><div>Reproduction in plants</div><div class="ans-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Yellow%20button%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%23F1C40F%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S4" /></div></div>
        <div class="opt"><div class="oid">R5</div><div>Protects seeds</div><div class="ans-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Orange%20button%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%23E67E22%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S5" /></div></div>
        <div class="opt"><div class="oid">R3</div><div>Makes food by photosynthesis</div><div class="ans-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Blue%20button%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%233498DB%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S3" /></div></div>
        <div class="opt"><div class="oid">R8</div><div>Protects the stem</div><div class="ans-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Blue%20button%20with%20white%20center%20circle%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%233498DB%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2211%22%20fill%3D%22%23FFFFFF%22%20stroke%3D%22%23999%22%20stroke-width%3D%221.2%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S8" /></div></div>
        <div class="opt"><div class="oid">R6</div><div>Grows into a new plant</div><div class="ans-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Red%20button%20with%20white%20center%20circle%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%23E74C3C%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2211%22%20fill%3D%22%23FFFFFF%22%20stroke%3D%22%23999%22%20stroke-width%3D%221.2%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S6" /></div></div>
        <div class="opt"><div class="oid">R7</div><div>Develops into flower or leaf</div><div class="ans-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Green%20button%20with%20white%20center%20circle%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%232ECC71%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2211%22%20fill%3D%22%23FFFFFF%22%20stroke%3D%22%23999%22%20stroke-width%3D%221.2%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S7" /></div></div>
        <div class="opt"><div class="oid">R9</div><div>Carries water and food in leaf</div><div class="ans-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Yellow%20button%20with%20white%20center%20circle%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%23F1C40F%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2211%22%20fill%3D%22%23FFFFFF%22%20stroke%3D%22%23999%22%20stroke-width%3D%221.2%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S9" /></div></div>
        <div class="opt"><div class="oid">R2</div><div>Supports plant and transports food</div><div class="ans-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Green%20button%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%232ECC71%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S2" /></div></div>
      </aside>
    </section>
  </article>
</body>
</html>
`,
  },
  {
    id: 'ws_s301_set13_plant_systems_advanced',
    title: 'Set13 Plant Systems Advanced',
    color: '#f59e0b',
    frontHtml: `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>WS_S301_SET13_PLANT_SYSTEMS_ADVANCED Front</title>
  <style>
    :root { --w: 794px; --h: 1123px; --line: #666; --head-bg: #d8efcb; --head-border: #80aa75; --panel-bg: #f8f8f4; }
    * { box-sizing: border-box; }
    body { margin: 0; padding: 18px; background: #ecefe8; font-family: "Trebuchet MS", Verdana, sans-serif; }
    .sheet { width: var(--w); height: var(--h); margin: 0 auto; background: #fff; border: 1.4px solid var(--line); position: relative; }
    .header { margin: 10px; border: 1px solid var(--head-border); background: var(--head-bg); padding: 10px 12px; display: grid; grid-template-columns: 1fr auto; gap: 10px; align-items: center; }
    .title { font-size: 15px; font-weight: 700; }
    .meta { font-size: 12px; color: #333; margin-top: 2px; }
    .badge { width: 36px; height: 36px; border-radius: 50%; border: 1px solid var(--line); display: grid; place-items: center; font-weight: 700; background: #f3f3f3; }
    .board { margin: 0 10px 10px; height: calc(100% - 92px); display: grid; grid-template-columns: 1fr 220px; gap: 10px; }
    .left { border: 1px solid var(--line); background: #fff; display: grid; grid-template-columns: 1fr 1fr; gap: 8px; padding: 10px; align-content: start; }
    .card { border: 1px dashed #bbb; border-radius: 6px; padding: 8px; display: grid; grid-template-columns: 44px 1fr auto; gap: 8px; align-items: center; min-height: 88px; }
    .icon { font-size: 30px; text-align: center; }
    .txt { font-size: 14px; font-weight: 700; }
    .slot { font-size: 12px; color: #333; margin-top: 4px; }
    .slot-btn img { width: 28px; height: 28px; display: block; }
    .right { border: 1px solid var(--line); background: var(--panel-bg); display: grid; grid-template-rows: repeat(10, 1fr); }
    .opt { border-bottom: 1px solid var(--line); padding: 6px; display: grid; grid-template-columns: 36px 1fr; gap: 6px; align-items: center; font-size: 13px; }
    .opt:last-child { border-bottom: 0; }
    .oid { font-weight: 700; text-align: center; }
    @media print { body { background: #fff; padding: 0; } .sheet { border: 1px solid #444; } }
  </style>
</head>
<body>
  <article class="sheet">
    <header class="header">
      <div>
        <div class="title">Match each plant survival systems with the correct answer.</div>
        <div class="meta">Worksheet ID: WS_S301_SET13_PLANT_SYSTEMS_ADVANCED | Structure: LP_FIXED_V1 | Side: Front</div>
      </div>
      <div class="badge">13</div>
    </header>
    <section class="board">
      <div class="left">
        <div class="card"><div class="icon">🍃</div><div><div class="txt">Leaf</div><div class="slot">Slot S3</div></div><div class="slot-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Blue%20button%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%233498DB%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S3" /></div></div>
        <div class="card"><div class="icon">🍃</div><div><div class="txt">Stomata</div><div class="slot">Slot S10</div></div><div class="slot-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Orange%20button%20with%20white%20center%20circle%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%23E67E22%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2211%22%20fill%3D%22%23FFFFFF%22%20stroke%3D%22%23999%22%20stroke-width%3D%221.2%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S10" /></div></div>
        <div class="card"><div class="icon">🧬</div><div><div class="txt">Vein</div><div class="slot">Slot S8</div></div><div class="slot-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Blue%20button%20with%20white%20center%20circle%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%233498DB%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2211%22%20fill%3D%22%23FFFFFF%22%20stroke%3D%22%23999%22%20stroke-width%3D%221.2%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S8" /></div></div>
        <div class="card"><div class="icon">🪵</div><div><div class="txt">Bark</div><div class="slot">Slot S7</div></div><div class="slot-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Green%20button%20with%20white%20center%20circle%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%232ECC71%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2211%22%20fill%3D%22%23FFFFFF%22%20stroke%3D%22%23999%22%20stroke-width%3D%221.2%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S7" /></div></div>
        <div class="card"><div class="icon">🌸</div><div><div class="txt">Flower</div><div class="slot">Slot S4</div></div><div class="slot-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Yellow%20button%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%23F1C40F%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S4" /></div></div>
        <div class="card"><div class="icon">🌿</div><div><div class="txt">Bud</div><div class="slot">Slot S6</div></div><div class="slot-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Red%20button%20with%20white%20center%20circle%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%23E74C3C%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2211%22%20fill%3D%22%23FFFFFF%22%20stroke%3D%22%23999%22%20stroke-width%3D%221.2%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S6" /></div></div>
        <div class="card"><div class="icon">🌼</div><div><div class="txt">Sepal</div><div class="slot">Slot S9</div></div><div class="slot-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Yellow%20button%20with%20white%20center%20circle%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%23F1C40F%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2211%22%20fill%3D%22%23FFFFFF%22%20stroke%3D%22%23999%22%20stroke-width%3D%221.2%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S9" /></div></div>
        <div class="card"><div class="icon">🌰</div><div><div class="txt">Seed</div><div class="slot">Slot S5</div></div><div class="slot-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Orange%20button%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%23E67E22%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S5" /></div></div>
        <div class="card"><div class="icon">🪴</div><div><div class="txt">Stem</div><div class="slot">Slot S2</div></div><div class="slot-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Green%20button%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%232ECC71%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S2" /></div></div>
        <div class="card"><div class="icon">🌱</div><div><div class="txt">Root</div><div class="slot">Slot S1</div></div><div class="slot-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Red%20button%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%23E74C3C%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S1" /></div></div>
      </div>
      <aside class="right">
        <div class="opt"><div class="oid">R7</div><div>Protects the stem</div></div>
        <div class="opt"><div class="oid">R8</div><div>Carries water and food in leaf</div></div>
        <div class="opt"><div class="oid">R3</div><div>Makes food by photosynthesis</div></div>
        <div class="opt"><div class="oid">R9</div><div>Protects the flower bud</div></div>
        <div class="opt"><div class="oid">R2</div><div>Supports plant and transports food</div></div>
        <div class="opt"><div class="oid">R4</div><div>Reproduction in plants</div></div>
        <div class="opt"><div class="oid">R1</div><div>Absorbs water and minerals</div></div>
        <div class="opt"><div class="oid">R5</div><div>Grows into a new plant</div></div>
        <div class="opt"><div class="oid">R10</div><div>Helps gas exchange</div></div>
        <div class="opt"><div class="oid">R6</div><div>Develops into flower or leaf</div></div>
      </aside>
    </section>
  </article>
</body>
</html>
`,
    backHtml: `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>WS_S301_SET13_PLANT_SYSTEMS_ADVANCED Flip</title>
  <style>
    :root { --w: 794px; --h: 1123px; --line: #666; --head-bg: #feeec9; --head-border: #b28d44; --panel-bg: #faf7ef; }
    * { box-sizing: border-box; }
    body { margin: 0; padding: 18px; background: #ecefe8; font-family: "Trebuchet MS", Verdana, sans-serif; }
    .sheet { width: var(--w); height: var(--h); margin: 0 auto; background: #fff; border: 1.4px solid var(--line); position: relative; }
    .header { margin: 10px; border: 1px solid var(--head-border); background: var(--head-bg); padding: 10px 12px; display: grid; grid-template-columns: 1fr auto; gap: 10px; align-items: center; }
    .title { font-size: 15px; font-weight: 700; }
    .meta { font-size: 12px; color: #333; margin-top: 2px; }
    .badge { width: 36px; height: 36px; border-radius: 50%; border: 1px solid var(--line); display: grid; place-items: center; font-weight: 700; background: #f3f3f3; }
    .board { margin: 0 10px 10px; height: calc(100% - 92px); display: grid; grid-template-columns: 1fr 220px; gap: 10px; }
    .left { border: 1px solid var(--line); background: #fff; display: grid; grid-template-columns: 1fr 1fr; gap: 8px; padding: 10px; align-content: start; }
    .card { border: 1px dashed #bbb; border-radius: 6px; padding: 8px; display: grid; grid-template-columns: 44px 1fr auto; gap: 8px; align-items: center; min-height: 88px; }
    .icon { font-size: 30px; text-align: center; }
    .txt { font-size: 14px; font-weight: 700; }
    .slot { font-size: 12px; color: #333; margin-top: 4px; }
    .slot-btn img { width: 28px; height: 28px; display: block; }
    .right { border: 1px solid var(--line); background: var(--panel-bg); display: grid; grid-template-rows: repeat(10, 1fr); }
    .opt { border-bottom: 1px solid var(--line); padding: 6px; display: grid; grid-template-columns: 34px 1fr auto; gap: 6px; align-items: center; font-size: 13px; }
    .opt:last-child { border-bottom: 0; }
    .oid { font-weight: 700; text-align: center; }
    .ans-btn img { width: 24px; height: 24px; display: block; }
    @media print { body { background: #fff; padding: 0; } .sheet { border: 1px solid #444; } }
  </style>
</head>
<body>
  <article class="sheet">
    <header class="header">
      <div>
        <div class="title">Answer Side: Match your front attempt with the correct button next to each option.</div>
        <div class="meta">Worksheet ID: WS_S301_SET13_PLANT_SYSTEMS_ADVANCED | Structure: LP_FIXED_V1 | Side: Flip</div>
      </div>
      <div class="badge">13</div>
    </header>
    <section class="board">
      <div class="left">
        <div class="card"><div class="icon">🍃</div><div><div class="txt">Leaf</div><div class="slot">Slot S3</div></div><div class="slot-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Blue%20button%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%233498DB%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S3" /></div></div>
        <div class="card"><div class="icon">🍃</div><div><div class="txt">Stomata</div><div class="slot">Slot S10</div></div><div class="slot-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Orange%20button%20with%20white%20center%20circle%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%23E67E22%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2211%22%20fill%3D%22%23FFFFFF%22%20stroke%3D%22%23999%22%20stroke-width%3D%221.2%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S10" /></div></div>
        <div class="card"><div class="icon">🧬</div><div><div class="txt">Vein</div><div class="slot">Slot S8</div></div><div class="slot-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Blue%20button%20with%20white%20center%20circle%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%233498DB%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2211%22%20fill%3D%22%23FFFFFF%22%20stroke%3D%22%23999%22%20stroke-width%3D%221.2%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S8" /></div></div>
        <div class="card"><div class="icon">🪵</div><div><div class="txt">Bark</div><div class="slot">Slot S7</div></div><div class="slot-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Green%20button%20with%20white%20center%20circle%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%232ECC71%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2211%22%20fill%3D%22%23FFFFFF%22%20stroke%3D%22%23999%22%20stroke-width%3D%221.2%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S7" /></div></div>
        <div class="card"><div class="icon">🌸</div><div><div class="txt">Flower</div><div class="slot">Slot S4</div></div><div class="slot-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Yellow%20button%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%23F1C40F%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S4" /></div></div>
        <div class="card"><div class="icon">🌿</div><div><div class="txt">Bud</div><div class="slot">Slot S6</div></div><div class="slot-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Red%20button%20with%20white%20center%20circle%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%23E74C3C%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2211%22%20fill%3D%22%23FFFFFF%22%20stroke%3D%22%23999%22%20stroke-width%3D%221.2%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S6" /></div></div>
        <div class="card"><div class="icon">🌼</div><div><div class="txt">Sepal</div><div class="slot">Slot S9</div></div><div class="slot-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Yellow%20button%20with%20white%20center%20circle%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%23F1C40F%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2211%22%20fill%3D%22%23FFFFFF%22%20stroke%3D%22%23999%22%20stroke-width%3D%221.2%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S9" /></div></div>
        <div class="card"><div class="icon">🌰</div><div><div class="txt">Seed</div><div class="slot">Slot S5</div></div><div class="slot-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Orange%20button%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%23E67E22%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S5" /></div></div>
        <div class="card"><div class="icon">🪴</div><div><div class="txt">Stem</div><div class="slot">Slot S2</div></div><div class="slot-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Green%20button%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%232ECC71%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S2" /></div></div>
        <div class="card"><div class="icon">🌱</div><div><div class="txt">Root</div><div class="slot">Slot S1</div></div><div class="slot-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Red%20button%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%23E74C3C%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S1" /></div></div>
      </div>
      <aside class="right">
        <div class="opt"><div class="oid">R7</div><div>Protects the stem</div><div class="ans-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Green%20button%20with%20white%20center%20circle%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%232ECC71%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2211%22%20fill%3D%22%23FFFFFF%22%20stroke%3D%22%23999%22%20stroke-width%3D%221.2%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S7" /></div></div>
        <div class="opt"><div class="oid">R8</div><div>Carries water and food in leaf</div><div class="ans-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Blue%20button%20with%20white%20center%20circle%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%233498DB%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2211%22%20fill%3D%22%23FFFFFF%22%20stroke%3D%22%23999%22%20stroke-width%3D%221.2%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S8" /></div></div>
        <div class="opt"><div class="oid">R3</div><div>Makes food by photosynthesis</div><div class="ans-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Blue%20button%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%233498DB%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S3" /></div></div>
        <div class="opt"><div class="oid">R9</div><div>Protects the flower bud</div><div class="ans-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Yellow%20button%20with%20white%20center%20circle%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%23F1C40F%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2211%22%20fill%3D%22%23FFFFFF%22%20stroke%3D%22%23999%22%20stroke-width%3D%221.2%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S9" /></div></div>
        <div class="opt"><div class="oid">R2</div><div>Supports plant and transports food</div><div class="ans-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Green%20button%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%232ECC71%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S2" /></div></div>
        <div class="opt"><div class="oid">R4</div><div>Reproduction in plants</div><div class="ans-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Yellow%20button%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%23F1C40F%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S4" /></div></div>
        <div class="opt"><div class="oid">R1</div><div>Absorbs water and minerals</div><div class="ans-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Red%20button%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%23E74C3C%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S1" /></div></div>
        <div class="opt"><div class="oid">R5</div><div>Grows into a new plant</div><div class="ans-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Orange%20button%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%23E67E22%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S5" /></div></div>
        <div class="opt"><div class="oid">R10</div><div>Helps gas exchange</div><div class="ans-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Orange%20button%20with%20white%20center%20circle%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%23E67E22%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2211%22%20fill%3D%22%23FFFFFF%22%20stroke%3D%22%23999%22%20stroke-width%3D%221.2%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S10" /></div></div>
        <div class="opt"><div class="oid">R6</div><div>Develops into flower or leaf</div><div class="ans-btn"><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20role%3D%22img%22%20aria-label%3D%22Red%20button%20with%20white%20center%20circle%22%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2229%22%20fill%3D%22%23E74C3C%22%20stroke%3D%22%23333%22%20stroke-width%3D%222%22%2F%3E%0A%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2211%22%20fill%3D%22%23FFFFFF%22%20stroke%3D%22%23999%22%20stroke-width%3D%221.2%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt="S6" /></div></div>
      </aside>
    </section>
  </article>
</body>
</html>
`,
  }
];
