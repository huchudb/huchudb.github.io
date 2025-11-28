<!-- 대출현황 섹션 -->
<section class="beta-section">
  <div class="stats-panel stats-panel--loan">
    <div class="stats-panel__header">
      <h2 class="stats-panel__title">대출 현황</h2>
      <div id="loanStatusMonth" class="stats-panel__meta"></div>
    </div>

    <div id="ontuLoanStatus" class="stats-panel__grid stats-panel__grid--loan">
      <!-- JS에서 .stats-card 렌더 -->
    </div>
  </div>
</section>

<!-- 상품유형별 대출잔액 섹션 -->
<section class="beta-section">
  <div class="stats-panel stats-panel--products">
    <div class="stats-panel__header">
      <h2 class="stats-panel__title">상품유형별 대출잔액</h2>
      <div id="productStatusMonth" class="stats-panel__meta"></div>
    </div>

    <div class="stats-panel__slider">
      <button class="stats-panel__nav stats-panel__nav--prev" type="button">‹</button>

      <div class="stats-panel__viewport">
        <div id="ontuProductSection" class="stats-panel__track">
          <!-- JS에서 .stats-card--product 렌더 -->
        </div>
      </div>

      <button class="stats-panel__nav stats-panel__nav--next" type="button">›</button>
    </div>
  </div>
</section>
