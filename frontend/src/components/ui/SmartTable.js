import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx';

/**
 * SmartTable - ตารางอัจฉริยะที่รองรับฟีเจอร์ครบถ้วน
 *
 * Features:
 * - Pagination (แบ่งหน้า)
 * - Sorting (เรียงลำดับ)
 * - Search/Filter (ค้นหา)
 * - Excel Export (ส่งออก Excel)
 * - Column Configuration (กำหนดคอลัมน์)
 * - Selection (เลือกแถว)
 * - Loading State
 * - Empty State
 * - Responsive Design
 *
 * @example
 * <SmartTable
 *   data={students}
 *   columns={[
 *     { key: 'studentCode', label: 'รหัส', sortable: true },
 *     { key: 'name', label: 'ชื่อ', sortable: true },
 *     { key: 'status', label: 'สถานะ', render: (value) => <Badge>{value}</Badge> }
 *   ]}
 *   searchable
 *   exportable
 *   selectable
 *   onRowClick={(row) => console.log(row)}
 * />
 */

const SmartTable = ({
  data = [],
  columns = [],
  loading = false,
  searchable = true,
  exportable = true,
  selectable = false,
  pagination = true,
  pageSize: defaultPageSize = 10,
  pageSizeOptions = [10, 25, 50, 100],
  title = '',
  exportFileName = 'export',
  onRowClick,
  onSelectionChange,
  actions,
  emptyMessage = 'ไม่พบข้อมูล',
  searchPlaceholder = 'ค้นหา...',
  className = '',
  stickyHeader = true,
  preservePageOnReload = true,
}) => {
  // State
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(defaultPageSize);
  const [selectedRows, setSelectedRows] = useState(new Set());

  // Track previous data length to detect actual data changes vs refreshes
  const prevDataLengthRef = useRef(data.length);
  const isInitialRender = useRef(true);

  // Adjust current page if it exceeds total pages after data change
  useEffect(() => {
    if (isInitialRender.current) {
      isInitialRender.current = false;
      prevDataLengthRef.current = data.length;
      return;
    }

    // Only reset page if data length significantly changed (e.g., filter applied)
    // or if current page is now out of bounds
    const totalPages = Math.ceil(data.length / pageSize);
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(totalPages);
    } else if (data.length === 0) {
      setCurrentPage(1);
    }

    prevDataLengthRef.current = data.length;
  }, [data.length, pageSize, currentPage]);

  // Filter data by search term
  const filteredData = useMemo(() => {
    if (!searchTerm) return data;

    const lowerSearch = searchTerm.toLowerCase();
    return data.filter(row => {
      return columns.some(col => {
        const value = getNestedValue(row, col.key);
        if (value === null || value === undefined) return false;
        return String(value).toLowerCase().includes(lowerSearch);
      });
    });
  }, [data, searchTerm, columns]);

  // Sort data
  const sortedData = useMemo(() => {
    if (!sortConfig.key) return filteredData;

    return [...filteredData].sort((a, b) => {
      const aValue = getNestedValue(a, sortConfig.key);
      const bValue = getNestedValue(b, sortConfig.key);

      if (aValue === null || aValue === undefined) return 1;
      if (bValue === null || bValue === undefined) return -1;

      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortConfig.direction === 'asc' ? aValue - bValue : bValue - aValue;
      }

      const aStr = String(aValue).toLowerCase();
      const bStr = String(bValue).toLowerCase();

      if (sortConfig.direction === 'asc') {
        return aStr.localeCompare(bStr, 'th');
      }
      return bStr.localeCompare(aStr, 'th');
    });
  }, [filteredData, sortConfig]);

  // Paginate data
  const paginatedData = useMemo(() => {
    if (!pagination) return sortedData;

    const startIndex = (currentPage - 1) * pageSize;
    return sortedData.slice(startIndex, startIndex + pageSize);
  }, [sortedData, currentPage, pageSize, pagination]);

  const totalPages = Math.ceil(sortedData.length / pageSize);

  // Helpers
  function getNestedValue(obj, path) {
    if (!path) return obj;
    return path.split('.').reduce((acc, part) => acc && acc[part], obj);
  }

  // Handlers
  const handleSort = useCallback((key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  }, []);

  const handlePageChange = useCallback((page) => {
    setCurrentPage(page);
    setSelectedRows(new Set());
  }, []);

  const handlePageSizeChange = useCallback((newSize) => {
    setPageSize(newSize);
    setCurrentPage(1);
    setSelectedRows(new Set());
  }, []);

  const handleSelectAll = useCallback((checked) => {
    if (checked) {
      const allIds = paginatedData.map((row, idx) => row.id || idx);
      setSelectedRows(new Set(allIds));
    } else {
      setSelectedRows(new Set());
    }
    onSelectionChange?.(checked ? paginatedData : []);
  }, [paginatedData, onSelectionChange]);

  const handleSelectRow = useCallback((row, idx) => {
    const id = row.id || idx;
    setSelectedRows(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }

      const selectedData = paginatedData.filter((r, i) => newSet.has(r.id || i));
      onSelectionChange?.(selectedData);

      return newSet;
    });
  }, [paginatedData, onSelectionChange]);

  const handleExport = useCallback(() => {
    const exportData = sortedData.map(row => {
      const obj = {};
      columns.forEach(col => {
        if (col.exportable !== false) {
          obj[col.label] = getNestedValue(row, col.key);
        }
      });
      return obj;
    });

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Data');

    // Auto-size columns
    const colWidths = columns.map(col => ({
      wch: Math.max(col.label.length, 15)
    }));
    ws['!cols'] = colWidths;

    XLSX.writeFile(wb, `${exportFileName}_${new Date().toISOString().split('T')[0]}.xlsx`);
  }, [sortedData, columns, exportFileName]);

  const isAllSelected = paginatedData.length > 0 &&
    paginatedData.every((row, idx) => selectedRows.has(row.id || idx));

  // Render
  return (
    <div className={`bg-white rounded-lg shadow overflow-hidden ${className}`}>
      {/* Header */}
      <div className="p-4 border-b bg-gray-50">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          {/* Title & Count */}
          <div>
            {title && <h3 className="text-lg font-semibold text-gray-800">{title}</h3>}
            <p className="text-sm text-gray-500">
              {loading && paginatedData.length === 0
                ? 'กำลังโหลด...'
                : `แสดง ${paginatedData.length} จาก ${sortedData.length} รายการ${loading ? ' (กำลังอัพเดต...)' : ''}`}
            </p>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Search */}
            {searchable && (
              <div className="relative">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setCurrentPage(1);
                  }}
                  placeholder={searchPlaceholder}
                  className="w-full sm:w-64 pl-9 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                />
                <svg className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm('')}
                    className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            )}

            {/* Export Button */}
            {exportable && data.length > 0 && (
              <button
                onClick={handleExport}
                className="flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span className="hidden sm:inline">Export Excel</span>
              </button>
            )}

            {/* Custom Actions */}
            {actions}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto relative">
        {/* Soft Loading Overlay - shows on top of existing data */}
        {loading && paginatedData.length > 0 && (
          <div className="absolute inset-0 bg-white bg-opacity-60 flex items-center justify-center z-10">
            <div className="flex items-center gap-2 px-4 py-2 bg-white rounded-lg shadow">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
              <span className="text-gray-600 text-sm">กำลังโหลด...</span>
            </div>
          </div>
        )}
        <table className="min-w-full divide-y divide-gray-200">
          <thead className={`bg-gray-50 ${stickyHeader ? 'sticky top-0 z-10' : ''}`}>
            <tr>
              {/* Checkbox Column */}
              {selectable && (
                <th className="w-12 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={isAllSelected}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                  />
                </th>
              )}

              {/* Data Columns */}
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider ${
                    col.sortable ? 'cursor-pointer hover:bg-gray-100 select-none' : ''
                  } ${col.className || ''}`}
                  style={{ width: col.width, minWidth: col.minWidth }}
                  onClick={() => col.sortable && handleSort(col.key)}
                >
                  <div className="flex items-center gap-1">
                    <span>{col.label}</span>
                    {col.sortable && (
                      <span className="flex flex-col">
                        <svg
                          className={`w-3 h-3 -mb-1 ${sortConfig.key === col.key && sortConfig.direction === 'asc' ? 'text-blue-600' : 'text-gray-300'}`}
                          fill="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path d="M12 8l-6 6h12z" />
                        </svg>
                        <svg
                          className={`w-3 h-3 ${sortConfig.key === col.key && sortConfig.direction === 'desc' ? 'text-blue-600' : 'text-gray-300'}`}
                          fill="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path d="M12 16l-6-6h12z" />
                        </svg>
                      </span>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {loading && paginatedData.length === 0 ? (
              // Loading State - only show when no existing data
              <tr>
                <td colSpan={columns.length + (selectable ? 1 : 0)} className="px-4 py-12 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
                    <span className="text-gray-500">กำลังโหลดข้อมูล...</span>
                  </div>
                </td>
              </tr>
            ) : !loading && paginatedData.length === 0 ? (
              // Empty State
              <tr>
                <td colSpan={columns.length + (selectable ? 1 : 0)} className="px-4 py-12 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <svg className="w-16 h-16 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <span className="text-gray-500">{emptyMessage}</span>
                    {searchTerm && (
                      <button
                        onClick={() => setSearchTerm('')}
                        className="text-blue-600 hover:text-blue-700 text-sm"
                      >
                        ล้างการค้นหา
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ) : (
              // Data Rows
              paginatedData.map((row, rowIndex) => {
                const rowId = row.id || rowIndex;
                const isSelected = selectedRows.has(rowId);

                return (
                  <tr
                    key={rowId}
                    className={`
                      ${onRowClick ? 'cursor-pointer' : ''}
                      ${isSelected ? 'bg-blue-50' : 'hover:bg-gray-50'}
                      transition-colors
                    `}
                    onClick={() => onRowClick?.(row)}
                  >
                    {selectable && (
                      <td className="w-12 px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleSelectRow(row, rowIndex)}
                          className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                        />
                      </td>
                    )}
                    {columns.map((col) => (
                      <td
                        key={col.key}
                        className={`px-4 py-3 text-sm ${col.cellClassName || ''}`}
                      >
                        {col.render
                          ? col.render(getNestedValue(row, col.key), row, rowIndex)
                          : getNestedValue(row, col.key) ?? '-'
                        }
                      </td>
                    ))}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pagination && !loading && sortedData.length > 0 && (
        <div className="px-4 py-3 border-t bg-gray-50">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            {/* Page Size Selector */}
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <span>แสดง</span>
              <select
                value={pageSize}
                onChange={(e) => handlePageSizeChange(Number(e.target.value))}
                className="px-2 py-1 border rounded focus:ring-2 focus:ring-blue-500"
              >
                {pageSizeOptions.map(size => (
                  <option key={size} value={size}>{size}</option>
                ))}
              </select>
              <span>รายการ</span>
            </div>

            {/* Page Navigation */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => handlePageChange(1)}
                disabled={currentPage === 1}
                className="p-2 rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                title="หน้าแรก"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
                </svg>
              </button>
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="p-2 rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                title="หน้าก่อน"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>

              {/* Page Numbers */}
              <div className="flex items-center gap-1 mx-2">
                {generatePageNumbers(currentPage, totalPages).map((page, idx) => (
                  page === '...' ? (
                    <span key={`ellipsis-${idx}`} className="px-2 text-gray-400">...</span>
                  ) : (
                    <button
                      key={page}
                      onClick={() => handlePageChange(page)}
                      className={`w-8 h-8 rounded text-sm font-medium transition-colors ${
                        currentPage === page
                          ? 'bg-blue-600 text-white'
                          : 'hover:bg-gray-200 text-gray-700'
                      }`}
                    >
                      {page}
                    </button>
                  )
                ))}
              </div>

              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="p-2 rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                title="หน้าถัดไป"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
              <button
                onClick={() => handlePageChange(totalPages)}
                disabled={currentPage === totalPages}
                className="p-2 rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                title="หน้าสุดท้าย"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                </svg>
              </button>
            </div>

            {/* Page Info */}
            <div className="text-sm text-gray-600">
              หน้า {currentPage} จาก {totalPages}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Helper function to generate page numbers
function generatePageNumbers(current, total) {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  if (current <= 3) {
    return [1, 2, 3, 4, 5, '...', total];
  }

  if (current >= total - 2) {
    return [1, '...', total - 4, total - 3, total - 2, total - 1, total];
  }

  return [1, '...', current - 1, current, current + 1, '...', total];
}

export default SmartTable;
