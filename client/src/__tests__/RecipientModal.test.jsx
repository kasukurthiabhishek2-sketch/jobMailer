import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import RecipientModal from '../components/RecipientModal';

describe('RecipientModal Consent Gate', () => {
  const makeSheetData = (overrides = {}) => ({
    filename: 'test-contacts.xlsx',
    sheetName: 'Sheet1',
    headerRowIndex: 0,
    columnMapping: { emailCol: 'Email', nameCol: 'Name', companyCol: 'Company', roleCol: null },
    totalCount: 2,
    validCount: 2,
    invalidCount: 0,
    rows: [
      {
        id: 'row_1',
        rowIndex: 1,
        excelRowNum: 2,
        email: 'alice@example.com',
        rawEmail: 'alice@example.com',
        name: 'Alice',
        company: 'Acme',
        role: '',
        isValidEmail: true,
        isDuplicate: false,
        isPreviouslyContacted: false,
        errorReason: null,
        isSelected: true,
        isApproved: false
      },
      {
        id: 'row_2',
        rowIndex: 2,
        excelRowNum: 3,
        email: 'bob@example.com',
        rawEmail: 'bob@example.com',
        name: 'Bob',
        company: 'Beta Inc',
        role: '',
        isValidEmail: true,
        isDuplicate: false,
        isPreviouslyContacted: false,
        errorReason: null,
        isSelected: false,
        isApproved: false
      }
    ],
    ...overrides
  });

  // The component initializes rows=[] and syncs from sheetData via a
  // prevSheetData comparison. To populate rows in tests, render first
  // with sheetData=null, then re-render with the actual data.
  function renderWithData(sheetData, props = {}) {
    const defaultProps = {
      isOpen: true,
      onClose: props.onClose || vi.fn(),
      onConfirmSelection: props.onConfirmSelection || vi.fn()
    };
    const { rerender } = render(
      <RecipientModal {...defaultProps} sheetData={null} />
    );
    rerender(
      <RecipientModal {...defaultProps} sheetData={sheetData} />
    );
    return { rerender, ...defaultProps };
  }

  it('does not call onConfirmSelection when consent checkbox is unchecked', () => {
    const onConfirm = vi.fn();
    const onClose = vi.fn();

    renderWithData(makeSheetData(), { onConfirmSelection: onConfirm, onClose });

    // row_1 is pre-selected, so the approve button should be enabled
    const approveBtn = screen.getByRole('button', { name: /Approve/i });
    expect(approveBtn).not.toBeDisabled();

    // Click approve without checking consent
    fireEvent.click(approveBtn);

    // Must NOT call onConfirmSelection — consent gate blocks it
    expect(onConfirm).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('does not call onConfirmSelection when no rows are selected', () => {
    const onConfirm = vi.fn();

    const data = makeSheetData();
    data.rows = data.rows.map(r => ({ ...r, isSelected: false }));

    renderWithData(data, { onConfirmSelection: onConfirm });

    // The approve button should be disabled with 0 selected
    const approveBtn = screen.getByRole('button', { name: /Approve/i });
    expect(approveBtn).toBeDisabled();

    // Force click on disabled button — should still be blocked
    fireEvent.click(approveBtn);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('calls onConfirmSelection when consent is checked AND rows are selected', () => {
    const onConfirm = vi.fn();
    const onClose = vi.fn();

    renderWithData(makeSheetData(), { onConfirmSelection: onConfirm, onClose });

    // Check the consent checkbox
    const consentCheckbox = screen.getByRole('checkbox', { name: /explicitly approve/i });
    fireEvent.click(consentCheckbox);
    expect(consentCheckbox.checked).toBe(true);

    // Click approve
    const approveBtn = screen.getByRole('button', { name: /Approve/i });
    fireEvent.click(approveBtn);

    // Must call onConfirmSelection with approved rows
    expect(onConfirm).toHaveBeenCalledTimes(1);
    const approvedRows = onConfirm.mock.calls[0][0];
    expect(approvedRows.length).toBe(1);
    expect(approvedRows[0].email).toBe('alice@example.com');
    expect(approvedRows[0].isApproved).toBe(true);
    expect(approvedRows[0].approvedAt).toBeDefined();

    // Modal should close
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('consent checkbox is never pre-checked on initial render', () => {
    renderWithData(makeSheetData());

    const consentCheckbox = screen.getByRole('checkbox', { name: /explicitly approve/i });
    expect(consentCheckbox.checked).toBe(false);
  });

  it('consent checkbox resets when new sheetData is provided', () => {
    const data1 = makeSheetData();
    const onClose = vi.fn();
    const onConfirm = vi.fn();

    const { rerender: doRerender } = render(
      <RecipientModal isOpen={true} onClose={onClose} sheetData={null} onConfirmSelection={onConfirm} />
    );

    // First, provide data1
    doRerender(
      <RecipientModal isOpen={true} onClose={onClose} sheetData={data1} onConfirmSelection={onConfirm} />
    );

    // Check consent
    const checkbox = screen.getByRole('checkbox', { name: /explicitly approve/i });
    fireEvent.click(checkbox);
    expect(checkbox.checked).toBe(true);

    // Provide entirely new sheetData object — consent must reset
    const data2 = makeSheetData({ filename: 'different.xlsx' });
    doRerender(
      <RecipientModal isOpen={true} onClose={onClose} sheetData={data2} onConfirmSelection={onConfirm} />
    );

    const resetCheckbox = screen.getByRole('checkbox', { name: /explicitly approve/i });
    expect(resetCheckbox.checked).toBe(false);
  });
});

describe('RecipientModal Pagination & Search Filter', () => {
  const makeManyRowsSheetData = (count = 60) => ({
    filename: 'large-contacts.xlsx',
    sheetName: 'Sheet1',
    headerRowIndex: 0,
    columnMapping: { emailCol: 'Email', nameCol: 'Name', companyCol: 'Company', roleCol: null },
    totalCount: count,
    validCount: count,
    invalidCount: 0,
    rows: Array.from({ length: count }, (_, i) => ({
      id: `row_${i + 1}`,
      rowIndex: i + 1,
      excelRowNum: i + 2,
      email: `user${i + 1}@example.com`,
      rawEmail: `user${i + 1}@example.com`,
      name: `User ${i + 1}`,
      company: `Company ${i + 1}`,
      role: '',
      isValidEmail: true,
      isDuplicate: false,
      isPreviouslyContacted: false,
      errorReason: null,
      isSelected: false,
      isApproved: false
    }))
  });

  function renderWithData(sheetData, props = {}) {
    const defaultProps = {
      isOpen: true,
      onClose: props.onClose || vi.fn(),
      onConfirmSelection: props.onConfirmSelection || vi.fn()
    };
    const { rerender } = render(
      <RecipientModal {...defaultProps} sheetData={null} />
    );
    rerender(
      <RecipientModal {...defaultProps} sheetData={sheetData} />
    );
    return { rerender, ...defaultProps };
  }

  it('paginates contacts into 25 rows per page and navigates between pages', () => {
    renderWithData(makeManyRowsSheetData(60));

    // Page 1: rows 1 to 25 visible
    expect(screen.getByText('user1@example.com')).toBeInTheDocument();
    expect(screen.getByText('user25@example.com')).toBeInTheDocument();
    expect(screen.queryByText('user26@example.com')).not.toBeInTheDocument();
    expect(screen.getByText('1–25', { selector: 'strong' })).toBeInTheDocument();
    expect(screen.getByText((_, el) => el?.tagName === 'SPAN' && el.textContent.includes('Page') && el.textContent.includes('1 of 3'))).toBeInTheDocument();

    const prevBtn = screen.getByRole('button', { name: 'Previous Page' });
    const nextBtn = screen.getByRole('button', { name: 'Next Page' });
    expect(prevBtn).toBeDisabled();
    expect(nextBtn).not.toBeDisabled();

    // Navigate to Page 2
    fireEvent.click(nextBtn);
    expect(screen.queryByText('user1@example.com')).not.toBeInTheDocument();
    expect(screen.getByText('user26@example.com')).toBeInTheDocument();
    expect(screen.getByText('user50@example.com')).toBeInTheDocument();
    expect(screen.queryByText('user51@example.com')).not.toBeInTheDocument();
    expect(screen.getByText('26–50', { selector: 'strong' })).toBeInTheDocument();
    expect(screen.getByText((_, el) => el?.tagName === 'SPAN' && el.textContent.includes('Page') && el.textContent.includes('2 of 3'))).toBeInTheDocument();
    expect(prevBtn).not.toBeDisabled();
    expect(nextBtn).not.toBeDisabled();

    // Navigate to Page 3
    fireEvent.click(nextBtn);
    expect(screen.queryByText('user26@example.com')).not.toBeInTheDocument();
    expect(screen.getByText('user51@example.com')).toBeInTheDocument();
    expect(screen.getByText('user60@example.com')).toBeInTheDocument();
    expect(screen.getByText('51–60', { selector: 'strong' })).toBeInTheDocument();
    expect(screen.getByText((_, el) => el?.tagName === 'SPAN' && el.textContent.includes('Page') && el.textContent.includes('3 of 3'))).toBeInTheDocument();
    expect(nextBtn).toBeDisabled();

    // Navigate back to Page 2
    fireEvent.click(prevBtn);
    expect(screen.getByText('user26@example.com')).toBeInTheDocument();
    expect(screen.getByText('26–50', { selector: 'strong' })).toBeInTheDocument();
    expect(screen.getByText((_, el) => el?.tagName === 'SPAN' && el.textContent.includes('Page') && el.textContent.includes('2 of 3'))).toBeInTheDocument();
  });

  it('resets page to 1 when search filter changes', () => {
    renderWithData(makeManyRowsSheetData(60));

    const nextBtn = screen.getByRole('button', { name: 'Next Page' });
    // Advance to Page 2
    fireEvent.click(nextBtn);
    expect(screen.getByText('26–50', { selector: 'strong' })).toBeInTheDocument();
    expect(screen.getByText((_, el) => el?.tagName === 'SPAN' && el.textContent.includes('Page') && el.textContent.includes('2 of 3'))).toBeInTheDocument();

    // Type into search filter
    const searchInput = screen.getByLabelText('Search contacts');
    fireEvent.change(searchInput, { target: { value: 'user' } });

    // Page must reset to 1
    expect(screen.getByText((_, el) => el?.tagName === 'SPAN' && el.textContent.includes('Page') && el.textContent.includes('1 of'))).toBeInTheDocument();
  });
});

