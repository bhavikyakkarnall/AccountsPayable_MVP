function VerticalBarChartCard({
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
          <div className="chart-grid">
            {items.map((item) => {
              const ratio = maxValue > 0 ? (item.value || 0) / maxValue : 0;
              const height = ratio > 0 ? `${Math.max(ratio * 100, 8)}%` : "0%";

              return (
                <div className="chart-column" key={item.id || item.label}>
                  <div className="chart-value">{formatValue(item.value)}</div>
                  <div className="chart-track">
                    <div className="chart-bar" style={{ height }} />
                  </div>
                  <div className="chart-label">{item.label}</div>
                  {item.subtitle ? <div className="chart-subtitle">{item.subtitle}</div> : null}
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

export default VerticalBarChartCard;
