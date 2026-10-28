import { t } from '../../i18n';
import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import * as XLSX from 'xlsx';
import WindowModal from './WindowModal';
import SmartComboBox from './SmartComboBox';
import { EmptyBox } from '../illustrations';

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
 *   bulkActions={[{ label: 'ลบ', danger: true, onClick: async (rows) => { await removeMany(rows); } }]}
 *   onRowClick={(row) => console.log(row)}
 * />
 *
 * Selection props (all optional):
 * - selectable: bool - แสดง checkbox (ตาราง) / checkbox ในการ์ด (มือถือ)
 * - getRowId: (row) => id - ค่าเริ่มต้น row.id
 * - bulkActions: [{ label, danger?, onClick: (selectedRows) => Promise|void }]
 * - onSelectionChange: (rows) => void - ถูกเรียกเมื่อผู้ใช้เปลี่ยนการเลือก
 *
 * ทุกตารางมีเหมือนกัน (บนคอม):
 * - คอลัมน์ # ลำดับแถวเสมอ (ปิดได้ด้วย showRowNumber={false})
 * - คลิกขวาที่แถว/หัวคอลัมน์: เปิด, rowActions ของหน้า, คัดลอกช่อง/แถว, ค้นหาค่านี้, เลือกแถว, เรียง, ดาวน์โหลด, พิมพ์
 * - เมนู ⋯ : ดาวน์โหลด Excel/CSV (ทั้งหมด/ที่เลือก), คัดลอกตาราง, พิมพ์, เลือกคอลัมน์ที่แสดง (จำไว้ต่อหน้า)
 * - rowActions: [{ label, onClick: (row) => void, danger?, show?: (row) => bool }]
 * - column.exportValue: (row) => ค่าที่ใช้ตอนดาวน์โหลด/คัดลอก (ค่าเริ่มต้น = ค่าดิบของ key)
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
  pageSizeOptions = [10, 25, 50, 100, 150, 200, 250],
  title = '',
  exportFileName = 'export',
  onRowClick,
  onSelectionChange,
  getRowId,
  bulkActions,
  actions,
  emptyMessage = t('ไม่พบข้อมูล'),
  searchPlaceholder = t('ค้นหา...'),
  className = '',
  stickyHeader = true,
  preservePageOnReload = true,
  filters,
  activeFilterCount = 0,
  onClearFilters,
  emptyAction,
  toolbarStart,
  rowActions,
  showRowNumber = true,
}) => {
  // State
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(defaultPageSize);
  const [selectedRows, setSelectedRows] = useState(() => new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [mobileLimit, setMobileLimit] = useState(50);
  const [menuOpen, setMenuOpen] = useState(false);
  const [filterSheet, setFilterSheet] = useState(false);
  const [ctxMenu, setCtxMenu] = useState(null); // { x, y, row, col, cellText }
  const [toast, setToast] = useState('');
  const [colPanel, setColPanel] = useState(false);

  // คอลัมน์ที่ซ่อน จำไว้ต่อหน้า + ต่อตาราง
  const colsKey = `smarttable.hidden.${typeof window !== 'undefined' ? window.location.pathname : ''}.${exportFileName}`;
  const [hiddenCols, setHiddenCols] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem(colsKey)) || []); } catch (e) { return new Set(); }
  });
  const toggleCol = (key) => setHiddenCols(prev => {
    const next = new Set(prev);
    if (next.has(key)) next.delete(key); else next.add(key);
    try { localStorage.setItem(colsKey, JSON.stringify([...next])); } catch (e) { /* storage ปิดอยู่ */ }
    return next;
  });
  const visibleColumns = useMemo(() => {
    const shown = columns.filter(c => !hiddenCols.has(c.key));
    return shown.length ? shown : columns;
  }, [columns, hiddenCols]);

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
  // มือถือ: แสดงทั้งหมดถ้าไม่เกิน 50 รายการ เกินนั้นใช้ปุ่ม 'โหลดเพิ่ม'
  const mobileData = useMemo(() => (pagination ? sortedData.slice(0, mobileLimit) : sortedData), [sortedData, mobileLimit, pagination]);

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
  }, []);

  const handlePageSizeChange = useCallback((newSize) => {
    setPageSize(newSize);
    setCurrentPage(1);
  }, []);

  // id ของแถว: getRowId -> row.id -> ลำดับใน data (กรณีแถวไม่มี id)
  const dataIndexMap = useMemo(() => {
    const map = new Map();
    data.forEach((row, i) => map.set(row, i));
    return map;
  }, [data]);
  const idOf = useCallback((row) => {
    const id = getRowId ? getRowId(row) : row?.id;
    return id === undefined || id === null ? `__idx_${dataIndexMap.get(row)}` : id;
  }, [getRowId, dataIndexMap]);

  // ค่าล่าสุดสำหรับ callback ที่เรียกนอกรอบ render
  const latestRef = useRef({});
  latestRef.current = { data, idOf, onSelectionChange };
  const mountedRef = useRef(true);
  useEffect(() => () => { mountedRef.current = false; }, []);

  const commitSelection = useCallback((nextIds) => {
    setSelectedRows(nextIds);
    const { data: rows, idOf: getId, onSelectionChange: notify } = latestRef.current;
    notify?.(rows.filter(r => nextIds.has(getId(r))));
  }, []);

  // ตัด id ที่ไม่อยู่ในข้อมูลที่กรองแล้วออก (data เปลี่ยน/ค้นหา/กรอง) - คง id ที่ยังอยู่
  useEffect(() => {
    if (!selectable) return;
    const existing = new Set(filteredData.map(r => idOf(r)));
    const prune = (prev) => {
      if (prev.size === 0) return prev;
      const next = new Set([...prev].filter(id => existing.has(id)));
      return next.size === prev.size ? prev : next;
    };
    const pruned = prune(selectedRows);
    if (pruned !== selectedRows) commitSelection(pruned);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredData, selectable, idOf]);

  const handleSelectAll = useCallback((checked, rows) => {
    const next = new Set(selectedRows);
    rows.forEach(r => (checked ? next.add(idOf(r)) : next.delete(idOf(r))));
    commitSelection(next);
  }, [selectedRows, idOf, commitSelection]);

  const handleSelectAllFiltered = useCallback(() => {
    commitSelection(new Set(sortedData.map(r => idOf(r))));
  }, [sortedData, idOf, commitSelection]);

  const handleClearSelection = useCallback(() => {
    commitSelection(new Set());
  }, [commitSelection]);

  const handleSelectRow = useCallback((row) => {
    const id = idOf(row);
    const next = new Set(selectedRows);
    if (next.has(id)) next.delete(id); else next.add(id);
    commitSelection(next);
  }, [selectedRows, idOf, commitSelection]);

  const selectedList = useMemo(
    () => (selectable && selectedRows.size > 0 ? data.filter(r => selectedRows.has(idOf(r))) : []),
    [selectable, selectedRows, data, idOf]
  );

  const runBulkAction = useCallback(async (action) => {
    if (bulkBusy) return;
    setBulkBusy(true);
    try {
      await action.onClick?.(selectedList);
      if (mountedRef.current) commitSelection(new Set());
    } catch (err) {
      // ผู้เรียกแสดงข้อผิดพลาดเอง - คงการเลือกไว้ให้ลองใหม่
    } finally {
      if (mountedRef.current) setBulkBusy(false);
    }
  }, [bulkBusy, selectedList, commitSelection]);

  // ค่าของช่องตอนดาวน์โหลด/คัดลอก
  const exportCell = (col, row) => {
    const v = col.exportValue ? col.exportValue(row) : getNestedValue(row, col.key);
    return v === null || v === undefined ? '' : (typeof v === 'object' ? JSON.stringify(v) : v);
  };
  const exportColumns = visibleColumns.filter(col => col.exportable !== false && !isActionColumn(col));
  const toRecords = (rows) => rows.map((row, i) => {
    const obj = showRowNumber ? { '#': i + 1 } : {};
    exportColumns.forEach(col => { obj[col.label] = exportCell(col, row); });
    return obj;
  });
  const fileStamp = () => `${exportFileName}_${new Date().toISOString().split('T')[0]}`;

  const handleExport = useCallback((rows = sortedData) => {
    const ws = XLSX.utils.json_to_sheet(toRecords(rows));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Data');
    ws['!cols'] = [...(showRowNumber ? [{ wch: 6 }] : []), ...exportColumns.map(col => ({ wch: Math.max(String(col.label).length, 15) }))];
    XLSX.writeFile(wb, `${fileStamp()}.xlsx`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortedData, exportColumns, exportFileName, showRowNumber]);

  const handleExportCsv = (rows = sortedData) => {
    const ws = XLSX.utils.json_to_sheet(toRecords(rows));
    // BOM ให้ Excel อ่านภาษาไทยถูก
    const blob = new Blob(['\ufeff' + XLSX.utils.sheet_to_csv(ws)], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${fileStamp()}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  const flash = (msg) => { setToast(msg); setTimeout(() => setToast(''), 1800); };
  const copyText = async (text, msg = t('คัดลอกแล้ว')) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch (e) {
      const ta = document.createElement('textarea');
      ta.value = text; document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); } catch (err) { /* เบราว์เซอร์ไม่ให้คัดลอก */ }
      ta.remove();
    }
    flash(msg);
  };
  // คัดลอกเป็นแท็บคั่น วางใน Excel/Google Sheets ได้ตรงช่อง
  const rowsToTsv = (rows, withHeader) => {
    const header = [...(showRowNumber ? ['#'] : []), ...exportColumns.map(c => c.label)].join('\t');
    const body = rows.map((row, i) => [...(showRowNumber ? [i + 1] : []), ...exportColumns.map(c => String(exportCell(c, row)).replace(/\s+/g, ' '))].join('\t'));
    return (withHeader ? [header, ...body] : body).join('\n');
  };

  // เมนูคลิกขวา: ปิดเมื่อกด Esc หรือเลื่อนหน้า
  useEffect(() => {
    if (!ctxMenu) return undefined;
    const close = (e) => { if (e.type !== 'keydown' || e.key === 'Escape') setCtxMenu(null); };
    window.addEventListener('keydown', close);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      window.removeEventListener('keydown', close);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [ctxMenu]);
  const openCtxMenu = (e, row, col) => {
    e.preventDefault();
    setMenuOpen(false);
    setCtxMenu({ x: e.clientX, y: e.clientY, row, col, cellText: (e.currentTarget.innerText || '').trim() });
  };

  const isAllSelected = paginatedData.length > 0 &&
    paginatedData.every(row => selectedRows.has(idOf(row)));
  const isSomeSelected = !isAllSelected && paginatedData.some(row => selectedRows.has(idOf(row)));
  const isMobileAllSelected = mobileData.length > 0 &&
    mobileData.every(row => selectedRows.has(idOf(row)));
  const selectedCount = selectedList.length;
  const hasBulkActions = Array.isArray(bulkActions) && bulkActions.length > 0;
  const canSelectAllFiltered = selectedCount > 0 && selectedCount < sortedData.length &&
    (isAllSelected || isMobileAllSelected);

  // ใช้ตัวแสดงผลเดียวกันทั้งตารางและการ์ดบนมือถือ
  const renderCell = (col, row, rowIndex) => col.render
    ? col.render(getNestedValue(row, col.key), row, rowIndex)
    : getNestedValue(row, col.key) ?? '-';
  // การ์ดมือถือ: บรรทัด 1 = mobilePrimary, บรรทัด 2 = ค่าอื่นไม่เกิน 3 ค่า (ไม่แสดงคอลัมน์ปุ่ม)
  const isActionCol = isActionColumn;
  const badgeCol = columns.find(col => col.mobileBadge);
  const mobileColumns = columns.filter(col => !col.hideOnMobile && !isActionCol(col) && col !== badgeCol);
  const primaryCol = mobileColumns.find(col => col.mobilePrimary) || mobileColumns[0];
  const secondaryCols = (mobileColumns.some(col => col.mobileSecondary)
    ? mobileColumns.filter(col => col.mobileSecondary && col !== primaryCol)
    : mobileColumns.filter(col => col !== primaryCol)
  ).slice(0, 3);

  // สถานะว่าง: บอกสาเหตุ + ทางไปต่อ
  const renderEmpty = () => (
    <div className="flex flex-col items-center gap-3 text-center">
      {searchTerm ? (
        <>
          <span className="text-gray-500">{t("ไม่พบ ลองค้นหาคำอื่น")}</span>
          <button type="button" onClick={() => { setSearchTerm(''); setMobileLimit(50); }} className="min-h-[44px] px-4 text-brand-600 text-sm hover:text-brand-700">{t("ล้างการค้นหา")}</button>
        </>
      ) : activeFilterCount > 0 && onClearFilters ? (
        <>
          <span className="text-gray-500">{t("ไม่พบ ลองล้างตัวกรอง")}</span>
          <button type="button" onClick={onClearFilters} className="min-h-[44px] px-4 text-brand-600 text-sm hover:text-brand-700">{t("ล้างตัวกรอง")}</button>
        </>
      ) : (
        <>
          <EmptyBox className="h-16 w-auto text-brand-300" />
          <span className="text-gray-500">{emptyMessage}</span>
          {emptyAction && <div className="flex flex-wrap justify-center gap-2">{emptyAction}</div>}
        </>
      )}
    </div>
  );

  // Render
  return (
    <div className={`min-w-0 bg-white rounded-lg shadow overflow-hidden ${className}`}>
      {/* Header */}
      <div className="p-4 border-b bg-gray-50">
        <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center sm:justify-between gap-3">
          {/* ของที่หน้าเรียกใส่เอง (เช่นชิปกรอง) อยู่แถวเดียวกับช่องค้นหา ไม่เปลืองอีกแถว */}
          {toolbarStart && <div className="min-w-0 sm:flex-1">{toolbarStart}</div>}
          {/* Title (ถ้ามี) และจำนวน: แสดงจำนวนเฉพาะตอนค้นหา/กรอง หรือเมื่อมือถือยังโหลดไม่ครบ */}
          {(title || loading || searchTerm || activeFilterCount > 0 || mobileData.length < sortedData.length) && (
            <div>
              {title && <h3 className="text-lg font-semibold text-gray-800">{title}</h3>}
              <p className="text-sm text-gray-500" aria-live="polite">
                {loading && paginatedData.length === 0
                  ? t('กำลังโหลด...')
                  : (searchTerm || activeFilterCount > 0)
                    ? t("พบ {length} รายการ{value2}", { length: sortedData.length, value2: loading ? t(' (กำลังอัพเดต...)') : '' })
                    : mobileData.length < sortedData.length
                      ? <><span className="md:hidden">{t("แสดง {length} จาก {length1} รายการ", { length: mobileData.length, length1: sortedData.length })}</span></>
                      : loading ? t('กำลังอัพเดต...') : null}
                {activeFilterCount > 0 && onClearFilters && (
                  <button type="button" onClick={onClearFilters} className="sm:hidden ml-2 inline-flex min-h-[44px] items-center px-2 text-brand-700 underline underline-offset-2">{t('ล้างตัวกรอง')}</button>
                )}
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex min-w-0 flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2 sm:ml-auto">
            {/* Search + ปุ่มตัวกรอง (มือถือ) */}
            <div className="flex w-full items-center gap-2 sm:w-auto">
            {searchable && (
              <div className="relative flex-1 sm:flex-none sm:w-auto">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setCurrentPage(1);
                    setMobileLimit(50);
                  }}
                  placeholder={searchPlaceholder}
                  aria-label={searchPlaceholder}
                  className="w-full min-h-[44px] sm:min-h-0 sm:w-64 pl-9 pr-11 sm:pr-8 py-2 border rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 text-sm"
                />
                <svg aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => setSearchTerm('')}
                    aria-label={t('ล้างการค้นหา')}
                    className="absolute right-0 top-0 flex h-full w-11 sm:w-8 items-center justify-center text-gray-400 hover:text-gray-600"
                  >
                    <svg aria-hidden="true" className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            )}

            {filters && (
              <button
                type="button"
                onClick={() => setFilterSheet(true)}
                className={`sm:hidden print:hidden inline-flex min-h-[44px] flex-none items-center gap-1.5 rounded-lg border px-3 text-sm ${activeFilterCount > 0 ? 'border-brand-500 bg-brand-50 text-brand-800' : 'border-gray-300 bg-white text-gray-700'}`}
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h18l-7 8v6l-4 2v-8L3 4z" />
                </svg>{t("ตัวกรอง")}{activeFilterCount > 0 && <span className="rounded-full bg-brand-600 px-1.5 text-xs text-white">{activeFilterCount}</span>}
              </button>
            )}

            {/* เมนู ⋯ : เก็บ 'ส่งออก Excel' ไว้ ไม่แย่งความเด่นจากปุ่มหลักของหน้า */}
            {exportable && data.length > 0 && (
              <div className="relative flex-none print:hidden">
                <button
                  type="button"
                  onClick={() => setMenuOpen(o => !o)}
                  aria-label={t("เมนูเพิ่มเติม")}
                  aria-haspopup="menu"
                  aria-expanded={menuOpen}
                  className="inline-flex min-h-[44px] min-w-[44px] sm:min-h-[36px] sm:min-w-[36px] items-center justify-center rounded-lg border border-gray-300 bg-white text-gray-600 hover:bg-gray-100"
                >
                  <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <circle cx="5" cy="12" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="19" cy="12" r="1.8" />
                  </svg>
                </button>
                {menuOpen && (
                  <>
                    <div className="fixed inset-0 z-20" onClick={() => setMenuOpen(false)} aria-hidden="true" />
                    <div role="menu" className="absolute right-0 z-30 mt-1 w-60 rounded-lg border bg-white py-1 shadow-lg">
                      {[
                        { label: t("ดาวน์โหลด Excel ({length} แถว)", { length: sortedData.length }), run: () => handleExport() },
                        { label: t('ดาวน์โหลด CSV'), run: () => handleExportCsv() },
                        selectedCount > 0 && { label: t("ดาวน์โหลด Excel เฉพาะที่เลือก ({selectedCount})", { selectedCount: selectedCount }), run: () => handleExport(selectedList) },
                        { sep: true },
                        { label: t('คัดลอกทั้งตาราง (วางใน Excel ได้)'), run: () => copyText(rowsToTsv(sortedData, true), t("คัดลอก {length} แถวแล้ว", { length: sortedData.length })) },
                        { label: t('พิมพ์ตาราง'), run: () => window.print(), desktop: true },
                        { label: t('เลือกคอลัมน์ที่แสดง'), run: () => setColPanel(true), desktop: true },
                      ].filter(Boolean).map((item, i) => (item.sep
                        ? <div key={i} className="my-1 border-t" role="separator" />
                        : (
                          <button
                            key={item.label}
                            type="button"
                            role="menuitem"
                            onClick={() => { setMenuOpen(false); item.run(); }}
                            className={`${item.desktop ? 'hidden md:flex' : 'flex'} min-h-[44px] w-full items-center gap-2 px-3 text-left text-sm text-gray-700 hover:bg-gray-50`}
                          >
                            {item.label}
                          </button>
                        )))}
                    </div>
                  </>
                )}
              </div>
            )}
            </div>

            {/* Custom Actions */}
            {actions}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className={`overflow-x-auto relative ${stickyHeader ? 'md:max-h-[70vh] md:overflow-y-auto print:max-h-none print:overflow-visible' : ''}`} style={{ WebkitOverflowScrolling: 'touch' }}>
        {/* Soft Loading Overlay - shows on top of existing data */}
        {loading && paginatedData.length > 0 && (
          <div className="absolute inset-0 bg-white bg-opacity-60 flex items-center justify-center z-10">
            <div className="flex items-center gap-2 px-4 py-2 bg-white rounded-lg shadow">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-brand-600"></div>
              <span className="text-gray-600 text-sm">{t("กำลังโหลด...")}</span>
            </div>
          </div>
        )}
        <table className="hidden md:table print:table min-w-full divide-y divide-gray-200">
          <thead className="bg-th border-b-2 border-brand-200 print:bg-none">
            <tr>
              {/* Checkbox Column */}
              {selectable && (
                <th className={`w-12 px-4 py-3 print:hidden ${stickyHeader ? 'sticky top-0 z-10 bg-th' : ''}`}>
                  <input
                    type="checkbox"
                    aria-label={t("เลือกทั้งหมดในหน้านี้")}
                    checked={isAllSelected}
                    ref={(el) => { if (el) el.indeterminate = isSomeSelected; }}
                    disabled={bulkBusy || paginatedData.length === 0}
                    onChange={(e) => handleSelectAll(e.target.checked, paginatedData)}
                    className="w-4 h-4 text-brand-600 rounded border-gray-300 focus:ring-brand-500"
                  />
                </th>
              )}

              {showRowNumber && (
                <th scope="col" className={`w-12 px-3 py-3 text-right text-sm font-semibold text-th-fg print:text-black ${stickyHeader ? 'sticky top-0 z-10 bg-th' : ''}`}>#</th>
              )}

              {/* Data Columns */}
              {visibleColumns.map((col) => (
                <th
                  key={col.key}
                  onContextMenu={(e) => openCtxMenu(e, null, col)}
                  className={`px-4 py-3 text-left text-sm font-semibold text-th-fg print:text-black tracking-wide ${stickyHeader ? 'sticky top-0 z-10 bg-th shadow-[inset_0_-2px_0_0_rgb(var(--th-fg)/0.15)] print:static print:shadow-none' : ''} ${
                    col.sortable ? 'cursor-pointer hover:brightness-95 select-none' : ''
                  } ${col.className || ''}`}
                  style={{ width: col.width, minWidth: col.minWidth }}
                  onClick={() => col.sortable && handleSort(col.key)}
                >
                  <div className="flex flex-nowrap items-center gap-1">
                    <span className="whitespace-nowrap">{typeof col.label === 'string' ? t(col.label) : col.label}</span>
                    {col.sortable && (
                      <span className="flex flex-col">
                        <svg
                          className={`w-3 h-3 -mb-1 ${sortConfig.key === col.key && sortConfig.direction === 'asc' ? 'text-th-fg' : 'text-brand-300'}`}
                          fill="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path d="M12 8l-6 6h12z" />
                        </svg>
                        <svg
                          className={`w-3 h-3 ${sortConfig.key === col.key && sortConfig.direction === 'desc' ? 'text-th-fg' : 'text-brand-300'}`}
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
              {onRowClick && <th className={`w-8 print:hidden ${stickyHeader ? 'sticky top-0 z-10 bg-th' : ''}`} aria-hidden="true"></th>}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {loading && paginatedData.length === 0 ? (
              // Loading State - only show when no existing data
              <tr>
                <td colSpan={visibleColumns.length + (selectable ? 1 : 0) + (onRowClick ? 1 : 0) + (showRowNumber ? 1 : 0)} className="px-4 py-12 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-600"></div>
                    <span className="text-gray-500">{t("กำลังโหลดข้อมูล...")}</span>
                  </div>
                </td>
              </tr>
            ) : !loading && paginatedData.length === 0 ? (
              // Empty State
              <tr>
                <td colSpan={visibleColumns.length + (selectable ? 1 : 0) + (onRowClick ? 1 : 0) + (showRowNumber ? 1 : 0)} className="px-4 py-12 text-center">
                  {renderEmpty()}
                </td>
              </tr>
            ) : (
              // Data Rows
              paginatedData.map((row, rowIndex) => {
                const rowId = row.id || rowIndex;
                const isSelected = selectable && selectedRows.has(idOf(row));

                return (
                  <tr
                    key={rowId}
                    className={`
                      group ${onRowClick ? 'cursor-pointer' : ''}
                      ${isSelected ? 'bg-brand-50' : onRowClick ? 'hover:bg-brand-50/60' : 'hover:bg-gray-50'}
                      transition-colors
                    `}
                    onClick={() => onRowClick?.(row)}
                  >
                    {selectable && (
                      <td className="w-12 px-4 py-3 print:hidden" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          aria-label={t("เลือกแถวนี้")}
                          checked={isSelected}
                          disabled={bulkBusy}
                          onChange={() => handleSelectRow(row)}
                          className="w-4 h-4 text-brand-600 rounded border-gray-300 focus:ring-brand-500"
                        />
                      </td>
                    )}
                    {showRowNumber && (
                      <td className="w-12 px-3 py-3 text-right text-sm tabular-nums text-gray-400" onContextMenu={(e) => openCtxMenu(e, row, null)}>
                        {(pagination ? (currentPage - 1) * pageSize : 0) + rowIndex + 1}
                      </td>
                    )}
                    {visibleColumns.map((col) => (
                      <td
                        key={col.key}
                        onContextMenu={(e) => openCtxMenu(e, row, col)}
                        className={`px-4 py-3 text-sm ${col.cellClassName || ''}`}
                      >
                        {renderCell(col, row, rowIndex)}
                      </td>
                    ))}
                    {onRowClick && (
                      <td className="w-8 pl-0 pr-3 py-3 text-right text-gray-300 group-hover:text-brand-600 print:hidden" aria-hidden="true">›</td>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>

        {/* การ์ดสำหรับหน้าจอเล็ก ใช้ข้อมูลและการเลือกแถวร่วมกับตาราง */}
        <div className="md:hidden print:hidden p-3 space-y-3">
          {selectable && paginatedData.length > 0 && (
            <label className="flex min-h-[44px] items-center gap-3 text-sm">
              <input type="checkbox" checked={isMobileAllSelected} disabled={bulkBusy} onChange={(e) => handleSelectAll(e.target.checked, mobileData)} className="h-5 w-5 rounded border-gray-300 text-brand-600" />{t("เลือกทั้งหมด")}</label>
          )}
          {paginatedData.length === 0 ? (
            <div className="py-12" role="status">
              {loading ? (
                <div className="flex flex-col items-center gap-3 text-gray-500">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600" aria-hidden="true"></div>
                  <span>{t("กำลังโหลดข้อมูล...")}</span>
                </div>
              ) : renderEmpty()}
            </div>
          ) : mobileData.map((row, rowIndex) => (
            <div
              key={row.id || rowIndex}
              className={`min-w-0 min-h-[56px] rounded-lg border px-3 py-2.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${selectable && selectedRows.has(idOf(row)) ? 'bg-brand-50 border-brand-200' : 'bg-white border-gray-200'} ${onRowClick ? 'cursor-pointer active:bg-gray-100' : ''}`}
              onClick={() => onRowClick?.(row)}
              role={onRowClick ? 'button' : undefined}
              tabIndex={onRowClick ? 0 : undefined}
              onKeyDown={onRowClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onRowClick(row); } } : undefined}
            >
              <div className="flex min-w-0 items-center gap-2">
                {selectable && (
                  <label className="-my-1 -ml-2 flex min-h-[44px] min-w-[44px] flex-none items-center justify-center" onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" aria-label={t("เลือกแถวนี้")} checked={selectedRows.has(idOf(row))} disabled={bulkBusy} onChange={() => handleSelectRow(row)} className="h-5 w-5 rounded border-gray-300 text-brand-600" />
                  </label>
                )}
                <div className="min-w-0 flex-1">
                  {primaryCol && (
                    <div className="min-w-0 break-words font-semibold leading-snug text-gray-900" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {renderCell(primaryCol, row, rowIndex)}
                    </div>
                  )}
                  {secondaryCols.length > 0 && (
                    <div className="mt-0.5 min-w-0 break-words text-sm text-gray-600" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {secondaryCols.map((col, i) => (
                        <React.Fragment key={col.key}>
                          {i > 0 && <span aria-hidden="true"> · </span>}
                          <span>{renderCell(col, row, rowIndex)}</span>
                        </React.Fragment>
                      ))}
                    </div>
                  )}
                </div>
                {badgeCol && <div className="flex-none">{renderCell(badgeCol, row, rowIndex)}</div>}
                {onRowClick && (
                  <svg className="h-5 w-5 flex-none text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                )}
              </div>
            </div>
          ))}
          {pagination && mobileData.length < sortedData.length && (
            <button
              type="button"
              onClick={() => setMobileLimit(l => l + 50)}
              className="w-full min-h-[44px] rounded-lg border border-gray-300 bg-white text-sm font-medium text-gray-700 active:bg-gray-100"
            >{t('โหลดเพิ่ม ({count} รายการ)', { count: sortedData.length - mobileData.length })}</button>
          )}
        </div>
      </div>

      {/* ตัวกรอง (bottom sheet บนมือถือ) */}
      {filters && (
        <WindowModal
          open={filterSheet}
          title={t("ตัวกรอง")}
          onClose={() => setFilterSheet(false)}
          id="smart-table-filter"
          footer={
            <div className="flex gap-2">
              {activeFilterCount > 0 && onClearFilters && (
                <button
                  type="button"
                  onClick={onClearFilters}
                  className="min-h-[48px] flex-none rounded-lg border border-gray-300 bg-white px-4 text-gray-700 active:bg-gray-100"
                >{t('ล้าง')}</button>
              )}
              <button
                type="button"
                onClick={() => setFilterSheet(false)}
                className="min-h-[48px] flex-1 rounded-lg bg-brand-600 font-medium text-white active:bg-brand-700"
              >{t('ดูผลลัพธ์ ({count})', { count: sortedData.length })}
              </button>
            </div>
          }
        >
          <div className="p-4 space-y-4">{filters}</div>
        </WindowModal>
      )}

      {/* เมนูคลิกขวา */}
      {ctxMenu && createPortal(
        <>
          <div className="fixed inset-0 z-[60]" onClick={() => setCtxMenu(null)} onContextMenu={(e) => { e.preventDefault(); setCtxMenu(null); }} aria-hidden="true" />
          <div
            role="menu"
            aria-label={t("เมนูของแถว")}
            className="fixed z-[61] w-64 rounded-lg border bg-white py-1 text-sm shadow-xl"
            style={{ left: Math.min(ctxMenu.x, window.innerWidth - 264), top: Math.min(ctxMenu.y, window.innerHeight - 420) }}
          >
            {(() => {
              const { row, col, cellText } = ctxMenu;
              const items = [
                row && onRowClick && { label: t('เปิด'), run: () => onRowClick(row), bold: true },
                ...(row && rowActions ? rowActions.filter(a => !a.show || a.show(row)).map(a => ({ label: a.label, run: () => a.onClick(row), danger: a.danger })) : []),
                { sep: true },
                cellText && { label: t("คัดลอก \"{value1}\"", { value1: cellText.length > 24 ? `${cellText.slice(0, 24)}…` : cellText }), run: () => copyText(cellText) },
                row && { label: t('คัดลอกทั้งแถว'), run: () => copyText(rowsToTsv([row], false)) },
                row && cellText && searchable && { label: t("ค้นหา \"{value1}\"", { value1: cellText.length > 18 ? `${cellText.slice(0, 18)}…` : cellText }), run: () => { setSearchTerm(cellText); setCurrentPage(1); } },
                searchTerm && { label: t('ล้างการค้นหา'), run: () => setSearchTerm('') },
                { sep: true },
                row && selectable && { label: selectedRows.has(idOf(row)) ? t('ไม่เลือกแถวนี้') : t('เลือกแถวนี้'), run: () => handleSelectRow(row) },
                selectable && { label: t("เลือกทั้งหมด ({length})", { length: sortedData.length }), run: handleSelectAllFiltered },
                col && col.sortable && { label: t("เรียง \"{label}\" น้อย → มาก", { label: typeof col.label === 'string' ? t(col.label) : col.label }), run: () => setSortConfig({ key: col.key, direction: 'asc' }) },
                col && col.sortable && { label: t("เรียง \"{label}\" มาก → น้อย", { label: typeof col.label === 'string' ? t(col.label) : col.label }), run: () => setSortConfig({ key: col.key, direction: 'desc' }) },
                sortConfig.key && { label: t('ยกเลิกการเรียง'), run: () => setSortConfig({ key: null, direction: 'asc' }) },
                col && !row && { label: t("ซ่อนคอลัมน์ \"{label}\"", { label: typeof col.label === 'string' ? t(col.label) : col.label }), run: () => toggleCol(col.key) },
                { sep: true },
                exportable && { label: t("ดาวน์โหลด Excel ({length} แถว)", { length: sortedData.length }), run: () => handleExport() },
                exportable && selectedCount > 0 && { label: t("ดาวน์โหลดเฉพาะที่เลือก ({selectedCount})", { selectedCount: selectedCount }), run: () => handleExport(selectedList) },
                exportable && { label: t('ดาวน์โหลด CSV'), run: () => handleExportCsv() },
                { label: t('พิมพ์ตาราง'), run: () => window.print() },
              ].filter(Boolean);
              // ตัดเส้นคั่นที่หัว/ท้าย/ซ้อนกัน
              const clean = items.filter((it, i) => !it.sep || (i > 0 && !items[i - 1].sep && i < items.length - 1));
              return clean.map((it, i) => (it.sep
                ? <div key={`sep-${i}`} className="my-1 border-t" role="separator" />
                : (
                  <button
                    key={it.label}
                    type="button"
                    role="menuitem"
                    onClick={() => { setCtxMenu(null); it.run(); }}
                    className={`flex min-h-[36px] w-full items-center px-3 text-left hover:bg-gray-50 ${it.danger ? 'text-red-600' : 'text-gray-700'} ${it.bold ? 'font-semibold' : ''}`}
                  >
                    <span className="truncate">{it.label}</span>
                  </button>
                )));
            })()}
          </div>
        </>,
        document.body
      )}

      {toast && createPortal(
        <div role="status" className="fixed bottom-6 left-1/2 z-[70] -translate-x-1/2 rounded-lg bg-gray-900 px-4 py-2 text-sm text-white shadow-lg print:hidden">{toast}</div>,
        document.body
      )}

      {/* เลือกคอลัมน์ที่แสดง */}
      {colPanel && (
        <WindowModal open id="smarttable-columns" title={t("เลือกคอลัมน์ที่แสดง")} onClose={() => setColPanel(false)} initialWidth="max-w-sm"
          footer={<button type="button" onClick={() => setColPanel(false)} className="w-full min-h-[44px] rounded-lg bg-brand-600 text-white">{t("เสร็จ")}</button>}>
          <div className="p-4 space-y-1">
            {columns.map(col => (
              <label key={col.key} className="flex min-h-[44px] items-center gap-3 rounded-lg px-2 hover:bg-gray-50">
                <input type="checkbox" checked={!hiddenCols.has(col.key)} onChange={() => toggleCol(col.key)} className="h-5 w-5 rounded border-gray-300 text-brand-600" />
                <span className="text-sm text-gray-800">{typeof col.label === 'string' ? t(col.label) : col.key}</span>
              </label>
            ))}
            <p className="pt-2 text-xs text-gray-500">{t("ระบบจำไว้ในเครื่องนี้ ซ่อนได้แต่ต้องเหลืออย่างน้อย 1 คอลัมน์")}</p>
          </div>
        </WindowModal>
      )}

      {/* แถบการทำงานกับแถวที่เลือก (ไม่พิมพ์ ไม่ส่งออก) */}
      {selectable && hasBulkActions && selectedCount > 0 && (
        <>
          <div className="h-16 lg:hidden print:hidden" aria-hidden="true" />
          <div
            role="toolbar"
            aria-label={t("จัดการรายการที่เลือก")}
            aria-busy={bulkBusy}
            className="print:hidden fixed inset-x-3 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-40 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-gray-200 bg-white px-3 py-2 shadow-lg lg:inset-x-auto lg:right-6 lg:bottom-4 lg:max-w-3xl"
          >
            <span className="text-sm font-medium text-gray-800" aria-live="polite">{t('เลือกแล้ว {count} รายการ', { count: selectedCount })}</span>
            {canSelectAllFiltered && (
              <button
                type="button"
                onClick={handleSelectAllFiltered}
                disabled={bulkBusy}
                className="min-h-[44px] px-1 text-sm text-brand-600 hover:text-brand-700 disabled:opacity-50"
              >{t('เลือกทั้งหมด {count} รายการ', { count: sortedData.length })}</button>
            )}
            <button
              type="button"
              onClick={handleClearSelection}
              disabled={bulkBusy}
              className="min-h-[44px] px-1 text-sm text-gray-600 hover:text-gray-800 disabled:opacity-50"
            >{t("ยกเลิกการเลือก")}</button>
            <div className="ml-auto flex flex-wrap items-center gap-2">
              {bulkBusy && <div className="h-5 w-5 animate-spin rounded-full border-b-2 border-brand-600" role="status" aria-label={t("กำลังดำเนินการ")} />}
              {(bulkActions || []).map((action) => (
                <button
                  key={action.label}
                  type="button"
                  onClick={() => runBulkAction(action)}
                  disabled={bulkBusy}
                  className={`min-h-[44px] rounded-lg px-4 text-sm font-medium text-white disabled:opacity-50 ${
                    action.danger ? 'bg-red-600 hover:bg-red-700' : 'bg-brand-600 hover:bg-brand-700'
                  }`}
                >
                  {action.label}
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Pagination (เฉพาะจอ md ขึ้นไป) */}
      {pagination && !loading && sortedData.length > 0 && (
        <div className="hidden md:block px-4 py-3 border-t bg-gray-50">
          <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center sm:justify-between gap-3">
            {/* Page Size Selector */}
            <div className="flex flex-wrap items-center gap-2 text-sm text-gray-600">
              <span>{t("แสดง")}</span>
              <SmartComboBox
                options={pageSizeOptions.map(size => ({ value: size, label: String(size) }))}
                value={pageSize}
                onChange={(val) => val && handlePageSizeChange(Number(val))}
                labelKey="label"
                valueKey="value"
                clearable={false}
                className="w-24"
              />
              <span>{t("รายการ")}</span>
            </div>

            {/* Page Navigation */}
            <div className="flex flex-wrap items-center gap-1">
              <button
                onClick={() => handlePageChange(1)}
                disabled={currentPage === 1}
                className="flex min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 items-center justify-center p-2 rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                title={t("หน้าแรก")}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
                </svg>
              </button>
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="flex min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 items-center justify-center p-2 rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                title={t("หน้าก่อน")}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>

              {/* Page Numbers */}
              <div className="flex flex-wrap items-center gap-1 sm:mx-2">
                {generatePageNumbers(currentPage, totalPages).map((page, idx) => (
                  page === '...' ? (
                    <span key={`ellipsis-${idx}`} className="hidden sm:inline px-2 text-gray-400">...</span>
                  ) : (
                    <button
                      key={page}
                      onClick={() => handlePageChange(page)}
                      aria-current={currentPage === page ? 'page' : undefined}
                      className={`${currentPage === page ? 'inline-flex' : 'hidden sm:inline-flex'} items-center justify-center min-w-[44px] h-11 sm:min-w-0 sm:w-8 sm:h-8 rounded text-sm font-medium transition-colors ${
                        currentPage === page
                          ? 'bg-brand-600 text-white'
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
                className="flex min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 items-center justify-center p-2 rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                title={t("หน้าถัดไป")}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
              <button
                onClick={() => handlePageChange(totalPages)}
                disabled={currentPage === totalPages}
                className="flex min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 items-center justify-center p-2 rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                title={t("หน้าสุดท้าย")}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                </svg>
              </button>
            </div>

            {/* Page Info */}
            <div className="text-sm text-gray-600">{t('หน้า {currentPage} จาก {totalPages}', { currentPage, totalPages })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Helper function to generate page numbers
function isActionColumn(col) {
  return col.isAction || col.key === 'actions' || col.key === 'action';
}

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

/**
 * AddFab - ปุ่มลอย "เพิ่ม" มุมขวาล่าง แสดงเฉพาะมือถือ (<sm)
 * หน้าที่ใช้ต้องเว้นที่ด้านล่าง (เช่น pb-24 sm:pb-0) เพื่อไม่ให้บังการ์ดสุดท้าย
 */
export const AddFab = ({ onClick, label }) => (
  <button
    type="button"
    onClick={onClick}
    aria-label={label}
    title={label}
    className="sm:hidden print:hidden fixed z-30 flex h-14 w-14 items-center justify-center rounded-full bg-brand-600 text-white shadow-lg hover:bg-brand-700 active:bg-brand-800 focus:outline-none focus:ring-4 focus:ring-brand-300"
    style={{ bottom: 'calc(5.5rem + env(safe-area-inset-bottom))', right: 'calc(1rem + env(safe-area-inset-right))' }}
  >
    <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
    </svg>
  </button>
);
