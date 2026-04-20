function HorizontalBarListCard({
  title,
  description,
  items,
  formatValue,
  emptyMessage = "No data available."
}) {
  const maxValue = items.reduce((currentMax, item) => Math.max(currentMax, item.value || 0), 0);

  return (
    <div className="card border-0 shadow-sm h-100">
      <div className="card-body">
        <div className="mb-3">
          <h2 className="h5 mb-1">{title}</h2>
          {description ? <p className="text-secondary mb-0">{description}</p> : null}
        </div>

        {items.length > 0 ? (
          <div className="d-flex flex-column gap-3">
            {items.map((item) => {
              const ratio = maxValue > 0 ? (item.value || 0) / maxValue : 0;
              const width = ratio > 0 ? `${Math.max(ratio * 100, 6)}%` : "0%";

              return (
                <div className="spend-bar-row" key={item.id || item.label}>
                  <div className="d-flex justify-content-between gap-3 mb-1">
                    <div className="fw-semibold">{item.label}</div>
                    <div className="text-nowrap">{formatValue(item.value)}</div>
                  </div>
                  <div className="spend-bar-track">
                    <div className="spend-bar-fill" style={{ width }} />
                  </div>
                  {item.subtitle ? <div className="small text-secondary mt-1">{item.subtitle}</div> : null}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="empty-chart-state">{emptyMessage}</div>
        )}
      </div>
    </div>
  );
}

export default HorizontalBarListCard;
