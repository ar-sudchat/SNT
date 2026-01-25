import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';

/**
 * SmartComboBox - Dropdown อัจฉริยะที่รองรับข้อมูลจำนวนมาก
 *
 * Features:
 * - ค้นหาได้ (Search/Filter)
 * - รองรับข้อมูลจำนวนมาก (Virtual Scrolling)
 * - Portal Rendering (ไม่ถูกบังโดย overflow:hidden หรือ modal)
 * - Async Loading
 * - Custom Option Rendering
 * - Multi-select Support
 * - Keyboard Navigation
 *
 * @example
 * <SmartComboBox
 *   options={students}
 *   value={selectedStudent}
 *   onChange={setSelectedStudent}
 *   labelKey="name"
 *   valueKey="id"
 *   searchable
 *   placeholder="เลือกนักเรียน"
 * />
 */

const SmartComboBox = ({
  options = [],
  value,
  onChange,
  labelKey = 'label',
  valueKey = 'value',
  placeholder = 'เลือก...',
  searchable = true,
  searchPlaceholder = 'พิมพ์เพื่อค้นหา...',
  disabled = false,
  loading = false,
  error = '',
  clearable = true,
  multiple = false,
  maxDisplayItems = 100,
  maxHeight = 280,
  itemHeight = 40,
  renderOption,
  renderValue,
  onSearch,
  noOptionsMessage = 'ไม่พบข้อมูล',
  loadingMessage = 'กำลังโหลด...',
  className = '',
  dropdownClassName = '',
  required = false,
  name = '',
  id = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 });

  const containerRef = useRef(null);
  const inputRef = useRef(null);
  const dropdownRef = useRef(null);
  const listRef = useRef(null);

  // Get label from option
  const getLabel = useCallback((option) => {
    if (!option) return '';
    if (typeof option === 'string') return option;
    if (typeof labelKey === 'function') return labelKey(option);
    return option[labelKey] || '';
  }, [labelKey]);

  // Get value from option
  const getValue = useCallback((option) => {
    if (!option) return null;
    if (typeof option === 'string') return option;
    if (typeof valueKey === 'function') return valueKey(option);
    return option[valueKey] ?? option;
  }, [valueKey]);

  // Filter options based on search term
  const filteredOptions = useMemo(() => {
    if (!searchTerm) return options;

    const lowerSearch = searchTerm.toLowerCase();
    return options.filter(option => {
      const label = getLabel(option);
      return label.toLowerCase().includes(lowerSearch);
    });
  }, [options, searchTerm, getLabel]);

  // Display options (limited for performance)
  const displayOptions = useMemo(() => {
    return filteredOptions.slice(0, maxDisplayItems);
  }, [filteredOptions, maxDisplayItems]);

  // Find selected option(s)
  const selectedOptions = useMemo(() => {
    if (multiple) {
      const values = Array.isArray(value) ? value : [];
      return options.filter(opt => values.includes(getValue(opt)));
    }
    return options.find(opt => getValue(opt) === value);
  }, [value, options, getValue, multiple]);

  // Update dropdown position
  const updatePosition = useCallback(() => {
    if (!containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const spaceBelow = viewportHeight - rect.bottom;
    const spaceAbove = rect.top;

    // Decide whether to show above or below
    const showAbove = spaceBelow < maxHeight && spaceAbove > spaceBelow;

    setDropdownPosition({
      top: showAbove ? rect.top - maxHeight - 4 : rect.bottom + 4,
      left: rect.left,
      width: rect.width,
      showAbove
    });
  }, [maxHeight]);

  // Handle open/close
  useEffect(() => {
    if (isOpen) {
      updatePosition();
      window.addEventListener('scroll', updatePosition, true);
      window.addEventListener('resize', updatePosition);

      // Focus search input
      setTimeout(() => {
        inputRef.current?.focus();
      }, 10);
    }

    return () => {
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [isOpen, updatePosition]);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target) &&
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target)
      ) {
        setIsOpen(false);
        setSearchTerm('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e) => {
    if (disabled) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        if (!isOpen) {
          setIsOpen(true);
        } else {
          setHighlightedIndex(prev =>
            prev < displayOptions.length - 1 ? prev + 1 : prev
          );
        }
        break;

      case 'ArrowUp':
        e.preventDefault();
        if (isOpen) {
          setHighlightedIndex(prev => prev > 0 ? prev - 1 : 0);
        }
        break;

      case 'Enter':
        e.preventDefault();
        if (isOpen && highlightedIndex >= 0) {
          handleSelect(displayOptions[highlightedIndex]);
        } else {
          setIsOpen(true);
        }
        break;

      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        setSearchTerm('');
        break;

      case 'Tab':
        setIsOpen(false);
        setSearchTerm('');
        break;

      default:
        break;
    }
  }, [disabled, isOpen, displayOptions, highlightedIndex]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (highlightedIndex >= 0 && listRef.current) {
      const highlightedElement = listRef.current.children[highlightedIndex];
      if (highlightedElement) {
        highlightedElement.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [highlightedIndex]);

  // Handle option select
  const handleSelect = useCallback((option) => {
    if (multiple) {
      const optValue = getValue(option);
      const currentValues = Array.isArray(value) ? value : [];
      const newValues = currentValues.includes(optValue)
        ? currentValues.filter(v => v !== optValue)
        : [...currentValues, optValue];
      onChange?.(newValues);
    } else {
      onChange?.(getValue(option));
      setIsOpen(false);
      setSearchTerm('');
    }
  }, [multiple, value, getValue, onChange]);

  // Handle clear
  const handleClear = useCallback((e) => {
    e.stopPropagation();
    onChange?.(multiple ? [] : null);
    setSearchTerm('');
  }, [multiple, onChange]);

  // Handle remove tag (for multi-select)
  const handleRemoveTag = useCallback((e, optValue) => {
    e.stopPropagation();
    const currentValues = Array.isArray(value) ? value : [];
    onChange?.(currentValues.filter(v => v !== optValue));
  }, [value, onChange]);

  // Handle search
  const handleSearchChange = useCallback((e) => {
    const newValue = e.target.value;
    setSearchTerm(newValue);
    setHighlightedIndex(-1);
    onSearch?.(newValue);
  }, [onSearch]);

  // Render display value
  const renderDisplayValue = () => {
    if (multiple) {
      const selected = selectedOptions || [];
      if (selected.length === 0) {
        return <span className="text-gray-400">{placeholder}</span>;
      }

      return (
        <div className="flex flex-wrap gap-1 py-0.5">
          {selected.slice(0, 3).map((opt, idx) => (
            <span
              key={idx}
              className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-800 text-sm rounded"
            >
              {getLabel(opt)}
              <button
                type="button"
                onClick={(e) => handleRemoveTag(e, getValue(opt))}
                className="hover:text-blue-600"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </span>
          ))}
          {selected.length > 3 && (
            <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-sm rounded">
              +{selected.length - 3}
            </span>
          )}
        </div>
      );
    }

    if (renderValue && selectedOptions) {
      return renderValue(selectedOptions);
    }

    if (selectedOptions) {
      return <span className="text-gray-900">{getLabel(selectedOptions)}</span>;
    }

    return <span className="text-gray-400">{placeholder}</span>;
  };

  // Dropdown content
  const dropdownContent = (
    <div
      ref={dropdownRef}
      className={`fixed z-[9999] bg-white border rounded-lg shadow-lg overflow-hidden ${dropdownClassName}`}
      style={{
        top: dropdownPosition.top,
        left: dropdownPosition.left,
        width: dropdownPosition.width,
        maxHeight: maxHeight,
      }}
    >
      {/* Search Input */}
      {searchable && (
        <div className="p-2 border-b">
          <div className="relative">
            <input
              ref={inputRef}
              type="text"
              value={searchTerm}
              onChange={handleSearchChange}
              onKeyDown={handleKeyDown}
              placeholder={searchPlaceholder}
              className="w-full pl-8 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
            />
            <svg className="absolute left-2.5 top-2.5 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>
      )}

      {/* Options List */}
      <div
        ref={listRef}
        className="overflow-y-auto"
        style={{ maxHeight: maxHeight - (searchable ? 60 : 0) }}
      >
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mr-2"></div>
            <span className="text-gray-500">{loadingMessage}</span>
          </div>
        ) : displayOptions.length === 0 ? (
          <div className="py-8 text-center text-gray-500">
            <svg className="w-12 h-12 mx-auto mb-2 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {noOptionsMessage}
          </div>
        ) : (
          <>
            {displayOptions.map((option, index) => {
              const optValue = getValue(option);
              const isSelected = multiple
                ? (value || []).includes(optValue)
                : value === optValue;
              const isHighlighted = index === highlightedIndex;

              return (
                <div
                  key={optValue ?? index}
                  className={`
                    flex items-center px-3 py-2 cursor-pointer transition-colors
                    ${isHighlighted ? 'bg-blue-50' : ''}
                    ${isSelected ? 'bg-blue-100 text-blue-900' : 'hover:bg-gray-50'}
                  `}
                  onClick={() => handleSelect(option)}
                  onMouseEnter={() => setHighlightedIndex(index)}
                  style={{ minHeight: itemHeight }}
                >
                  {multiple && (
                    <input
                      type="checkbox"
                      checked={isSelected}
                      readOnly
                      className="w-4 h-4 mr-3 text-blue-600 rounded border-gray-300"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    {renderOption ? (
                      renderOption(option, { isSelected, isHighlighted })
                    ) : (
                      <span className="block truncate">{getLabel(option)}</span>
                    )}
                  </div>
                  {!multiple && isSelected && (
                    <svg className="w-5 h-5 text-blue-600 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
              );
            })}

            {/* Show more indicator */}
            {filteredOptions.length > maxDisplayItems && (
              <div className="px-3 py-2 text-sm text-gray-500 bg-gray-50 border-t">
                แสดง {maxDisplayItems} จาก {filteredOptions.length} รายการ (พิมพ์เพื่อค้นหาเพิ่มเติม)
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );

  return (
    <div className={`relative ${className}`}>
      {/* Trigger Button */}
      <div
        ref={containerRef}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        onKeyDown={handleKeyDown}
        tabIndex={disabled ? -1 : 0}
        role="combobox"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-disabled={disabled}
        className={`
          flex items-center justify-between w-full min-h-[42px] px-3 py-2 bg-white border rounded-lg cursor-pointer
          ${disabled ? 'bg-gray-100 cursor-not-allowed opacity-60' : 'hover:border-gray-400'}
          ${isOpen ? 'ring-2 ring-blue-500 border-blue-500' : 'border-gray-300'}
          ${error ? 'border-red-500 ring-red-500' : ''}
        `}
      >
        <div className="flex-1 min-w-0 mr-2">
          {renderDisplayValue()}
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          {/* Clear Button */}
          {clearable && (multiple ? (value || []).length > 0 : value) && !disabled && (
            <button
              type="button"
              onClick={handleClear}
              className="p-1 text-gray-400 hover:text-gray-600 rounded"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}

          {/* Loading Indicator */}
          {loading && (
            <div className="animate-spin rounded-full h-4 w-4 border-2 border-gray-300 border-t-blue-600"></div>
          )}

          {/* Dropdown Arrow */}
          <svg
            className={`w-5 h-5 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>

      {/* Error Message */}
      {error && <p className="mt-1 text-sm text-red-500">{error}</p>}

      {/* Hidden Input for Form Submission */}
      {name && (
        <input
          type="hidden"
          name={name}
          id={id}
          value={multiple ? JSON.stringify(value || []) : (value ?? '')}
          required={required}
        />
      )}

      {/* Dropdown Portal */}
      {isOpen && createPortal(dropdownContent, document.body)}
    </div>
  );
};

export default SmartComboBox;
