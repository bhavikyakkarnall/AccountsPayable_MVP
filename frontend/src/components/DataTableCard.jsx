function DataTableCard({ title, description, columns, rows, emptyMessage = "No records found." }) {
  return (
    <div className="card border-0 shadow-sm">
      <div className="card-body">
        <div className="mb-3">
          <h2 className="h5 mb-1">{title}</h2>
          {description ? <p className="text-secondary mb-0">{description}</p> : null}
        </div>
        <div className="table-responsive">
          <table className="table align-middle mb-0">
            <thead>
              <tr>
                {columns.map((column) => (
                  <th key={column.key} scope="col">
                    {column.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.length > 0 ? (
                rows.map((row, index) => (
                  <tr key={row.id || index}>
                    {columns.map((column) => (
                      <td key={column.key}>{row[column.key]}</td>
                    ))}
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="text-center text-secondary py-4" colSpan={columns.length}>
                    {emptyMessage}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default DataTableCard;
