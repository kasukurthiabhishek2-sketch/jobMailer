import React, { act } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import RecipientModal from '../components/RecipientModal';
import RecipientManager from '../components/RecipientManager';
import { fetchOutreachLogs } from '../services/api';

vi.mock('../services/api', () => ({
  uploadRecipientsSheet: vi.fn(),
  fetchOutreachLogs: vi.fn()
}));

function makeRows(count, { preSelected = false } = {}) {
  return Array.from({ length: count }, (_, i) => ({
    id: `row_${i + 1}`,
    rowIndex: i + 1,
    excelRowNum: i + 2,
    email: `contact${i + 1}@domain.com`,
    rawEmail: `contact${i + 1}@domain.com`,
    name: `Contact ${i + 1}`,
    company: `Company ${i + 1}`,
    role: `Role ${i + 1}`,
    isValidEmail: true,
    isDuplicate: false,
    isPreviouslyContacted: false,
    errorReason: null,
    isSelected: preSelected,
    isApproved: false
  }));
}

function makeSheetData(rows = []) {
  return {
    filename: 'test_contacts.xlsx',
    sheetName: 'Sheet1',
    headerRowIndex: 0,
    columnMapping: { emailCol: 'Email', nameCol: 'Name', companyCol: 'Company', roleCol: 'Role' },
    totalCount: rows.length,
    validCount: rows.filter(r => r.isValidEmail).length,
    invalidCount: rows.filter(r => !r.isValidEmail).length,
    rows
  };
}

function renderModalWithData(sheetData, props = {}) {
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

describe('RecipientModal Empirical Pagination & Selection Stress Suite', () => {
  it('handles 0 rows boundary: renders empty state and disables navigation buttons', () => {
    renderModalWithData(makeSheetData([]));

    expect(screen.getByText('No contacts matching your search/filter criteria.')).toBeInTheDocument();
    expect(screen.getByText((_, el) => el?.tagName === 'SPAN' && el.textContent.includes('Showing 0 of 0 rows'))).toBeInTheDocument();
    expect(screen.getByText((_, el) => el?.tagName === 'SPAN' && el.textContent.includes('Page') && el.textContent.includes('1 of 1'))).toBeInTheDocument();

    const prevBtn = screen.getByRole('button', { name: 'Previous Page' });
    const nextBtn = screen.getByRole('button', { name: 'Next Page' });
    expect(prevBtn).toBeDisabled();
    expect(nextBtn).toBeDisabled();
  });

  it('handles 1 row boundary: renders single row with disabled navigation buttons', () => {
    renderModalWithData(makeSheetData(makeRows(1)));

    expect(screen.getByText('contact1@domain.com')).toBeInTheDocument();
    expect(screen.getByText('1–1', { selector: 'strong' })).toBeInTheDocument();
    expect(screen.getByText((_, el) => el?.tagName === 'SPAN' && el.textContent.includes('Page') && el.textContent.includes('1 of 1'))).toBeInTheDocument();

    const prevBtn = screen.getByRole('button', { name: 'Previous Page' });
    const nextBtn = screen.getByRole('button', { name: 'Next Page' });
    expect(prevBtn).toBeDisabled();
    expect(nextBtn).toBeDisabled();
  });

  it('handles exact boundary of 25 rows: fits exactly on page 1 with navigation disabled', () => {
    renderModalWithData(makeSheetData(makeRows(25)));

    expect(screen.getByText('contact1@domain.com')).toBeInTheDocument();
    expect(screen.getByText('contact25@domain.com')).toBeInTheDocument();
    expect(screen.queryByText('contact26@domain.com')).not.toBeInTheDocument();

    expect(screen.getByText('1–25', { selector: 'strong' })).toBeInTheDocument();
    expect(screen.getByText((_, el) => el?.tagName === 'SPAN' && el.textContent.includes('Page') && el.textContent.includes('1 of 1'))).toBeInTheDocument();

    const prevBtn = screen.getByRole('button', { name: 'Previous Page' });
    const nextBtn = screen.getByRole('button', { name: 'Next Page' });
    expect(prevBtn).toBeDisabled();
    expect(nextBtn).toBeDisabled();
  });

  it('handles 26 rows: precisely splits into 2 pages (25 on page 1, 1 on page 2)', () => {
    renderModalWithData(makeSheetData(makeRows(26)));

    // Page 1
    expect(screen.getByText('contact1@domain.com')).toBeInTheDocument();
    expect(screen.getByText('contact25@domain.com')).toBeInTheDocument();
    expect(screen.queryByText('contact26@domain.com')).not.toBeInTheDocument();
    expect(screen.getByText('1–25', { selector: 'strong' })).toBeInTheDocument();
    expect(screen.getByText((_, el) => el?.tagName === 'SPAN' && el.textContent.includes('Page') && el.textContent.includes('1 of 2'))).toBeInTheDocument();

    const prevBtn = screen.getByRole('button', { name: 'Previous Page' });
    const nextBtn = screen.getByRole('button', { name: 'Next Page' });
    expect(prevBtn).toBeDisabled();
    expect(nextBtn).not.toBeDisabled();

    // Advance to Page 2
    fireEvent.click(nextBtn);
    expect(screen.queryByText('contact1@domain.com')).not.toBeInTheDocument();
    expect(screen.queryByText('contact25@domain.com')).not.toBeInTheDocument();
    expect(screen.getByText('contact26@domain.com')).toBeInTheDocument();
    expect(screen.getByText('26–26', { selector: 'strong' })).toBeInTheDocument();
    expect(screen.getByText((_, el) => el?.tagName === 'SPAN' && el.textContent.includes('Page') && el.textContent.includes('2 of 2'))).toBeInTheDocument();

    expect(prevBtn).not.toBeDisabled();
    expect(nextBtn).toBeDisabled();

    // Retreat to Page 1
    fireEvent.click(prevBtn);
    expect(screen.getByText('contact1@domain.com')).toBeInTheDocument();
    expect(screen.getByText('contact25@domain.com')).toBeInTheDocument();
    expect(screen.queryByText('contact26@domain.com')).not.toBeInTheDocument();
    expect(screen.getByText('1–25', { selector: 'strong' })).toBeInTheDocument();
    expect(prevBtn).toBeDisabled();
    expect(nextBtn).not.toBeDisabled();
  });

  it('handles 100+ rows (105 rows): 5 pages with correct boundary clamping on Next/Prev clicks', () => {
    renderModalWithData(makeSheetData(makeRows(105)));

    expect(screen.getByText((_, el) => el?.tagName === 'SPAN' && el.textContent.includes('Page') && el.textContent.includes('1 of 5'))).toBeInTheDocument();
    expect(screen.getByText('1–25', { selector: 'strong' })).toBeInTheDocument();

    const prevBtn = screen.getByRole('button', { name: 'Previous Page' });
    const nextBtn = screen.getByRole('button', { name: 'Next Page' });

    // Boundary clamp: clicking disabled prev on Page 1 does nothing
    fireEvent.click(prevBtn);
    expect(screen.getByText('1–25', { selector: 'strong' })).toBeInTheDocument();

    // Advance through pages 2, 3, 4, 5
    fireEvent.click(nextBtn); // Page 2: 26-50
    expect(screen.getByText('26–50', { selector: 'strong' })).toBeInTheDocument();
    fireEvent.click(nextBtn); // Page 3: 51-75
    expect(screen.getByText('51–75', { selector: 'strong' })).toBeInTheDocument();
    fireEvent.click(nextBtn); // Page 4: 76-100
    expect(screen.getByText('76–100', { selector: 'strong' })).toBeInTheDocument();
    fireEvent.click(nextBtn); // Page 5: 101-105
    expect(screen.getByText('101–105', { selector: 'strong' })).toBeInTheDocument();
    expect(screen.getByText((_, el) => el?.tagName === 'SPAN' && el.textContent.includes('Page') && el.textContent.includes('5 of 5'))).toBeInTheDocument();
    expect(screen.getByText('contact105@domain.com')).toBeInTheDocument();
    expect(nextBtn).toBeDisabled();
    expect(prevBtn).not.toBeDisabled();

    // Boundary clamp: clicking disabled next on last page does nothing
    fireEvent.click(nextBtn);
    expect(screen.getByText('101–105', { selector: 'strong' })).toBeInTheDocument();
    expect(screen.getByText((_, el) => el?.tagName === 'SPAN' && el.textContent.includes('Page') && el.textContent.includes('5 of 5'))).toBeInTheDocument();
  });

  it('clamps page back to 1 upon rapid search filtering from page 3', () => {
    renderModalWithData(makeSheetData(makeRows(100)));

    const nextBtn = screen.getByRole('button', { name: 'Next Page' });
    // Advance to Page 3
    fireEvent.click(nextBtn); // Page 2
    fireEvent.click(nextBtn); // Page 3
    expect(screen.getByText('51–75', { selector: 'strong' })).toBeInTheDocument();
    expect(screen.getByText((_, el) => el?.tagName === 'SPAN' && el.textContent.includes('Page') && el.textContent.includes('3 of 4'))).toBeInTheDocument();

    const searchInput = screen.getByLabelText('Search contacts');

    // Filter down to rows matching "contact9" (matches contact9, contact90..99)
    fireEvent.change(searchInput, { target: { value: 'contact9' } });

    // Assert page clamped back to 1
    expect(screen.getByText((_, el) => el?.tagName === 'SPAN' && el.textContent.includes('Page') && el.textContent.includes('1 of 1'))).toBeInTheDocument();
    expect(screen.getByText('1–11', { selector: 'strong' })).toBeInTheDocument();

    // Rapid search to 0 matches
    fireEvent.change(searchInput, { target: { value: 'nonexistent-query-xyz' } });
    expect(screen.getByText('No contacts matching your search/filter criteria.')).toBeInTheDocument();
    expect(screen.getByText((_, el) => el?.tagName === 'SPAN' && el.textContent.includes('Page') && el.textContent.includes('1 of 1'))).toBeInTheDocument();

    // Clear search
    fireEvent.change(searchInput, { target: { value: '' } });
    expect(screen.getByText((_, el) => el?.tagName === 'SPAN' && el.textContent.includes('Page') && el.textContent.includes('1 of 4'))).toBeInTheDocument();
    expect(screen.getByText('1–25', { selector: 'strong' })).toBeInTheDocument();
  });

  it('supports Shift-click multi-selection across page boundaries', () => {
    const rows = makeRows(60, { preSelected: false });
    renderModalWithData(makeSheetData(rows));

    // Page 1: click first row (index 0) without shift
    const row1 = screen.getByText('contact1@domain.com').closest('tr');
    fireEvent.click(row1);

    // Verify row 1 is selected
    expect(row1).toHaveClass('row-selected');
    expect(screen.getByRole('radio', { name: /Selected 1/i })).toBeInTheDocument();
    expect(screen.getByText(/Approve & Import 1 Contacts/i)).toBeInTheDocument();

    // Advance to Page 2
    const nextBtn = screen.getByRole('button', { name: 'Next Page' });
    fireEvent.click(nextBtn);
    expect(screen.getByText('26–50', { selector: 'strong' })).toBeInTheDocument();

    // On Page 2, row index 27 in global rows is contact28@domain.com (3rd item on page 2)
    const targetRowPage2 = screen.getByText('contact28@domain.com').closest('tr');
    // Shift-click target row on Page 2
    fireEvent.click(targetRowPage2, { shiftKey: true });

    // Now all rows from index 0 to index 27 (28 rows total) must be selected!
    expect(screen.getByRole('radio', { name: /Selected 28/i })).toBeInTheDocument();
    expect(screen.getByText(/Approve & Import 28 Contacts/i)).toBeInTheDocument();

    // Verify rows on Page 2
    expect(screen.getByText('contact26@domain.com').closest('tr')).toHaveClass('row-selected');
    expect(screen.getByText('contact27@domain.com').closest('tr')).toHaveClass('row-selected');
    expect(screen.getByText('contact28@domain.com').closest('tr')).toHaveClass('row-selected');
    expect(screen.getByText('contact29@domain.com').closest('tr')).not.toHaveClass('row-selected');

    // Return to Page 1 and verify selection persisted across navigation
    const prevBtn = screen.getByRole('button', { name: 'Previous Page' });
    fireEvent.click(prevBtn);
    expect(screen.getByText('1–25', { selector: 'strong' })).toBeInTheDocument();
    expect(screen.getByText('contact1@domain.com').closest('tr')).toHaveClass('row-selected');
    expect(screen.getByText('contact25@domain.com').closest('tr')).toHaveClass('row-selected');
  });

  it('safely ignores invalid emails during Shift-click across page boundaries without selecting them', () => {
    const rows = makeRows(60, { preSelected: false });
    // Make every 5th row invalid
    rows.forEach((r, idx) => {
      if ((idx + 1) % 5 === 0) {
        r.isValidEmail = false;
        r.errorReason = 'Invalid email syntax';
      }
    });

    renderModalWithData(makeSheetData(rows));

    // Page 1: click first row (index 0, valid)
    const row1 = screen.getByText('contact1@domain.com').closest('tr');
    fireEvent.click(row1);
    expect(row1).toHaveClass('row-selected');

    // Advance to Page 2
    const nextBtn = screen.getByRole('button', { name: 'Next Page' });
    fireEvent.click(nextBtn);

    // On Page 2, shift-click row index 29 (contact30@domain.com, which is invalid: 30 % 5 === 0)
    // Wait, row 29 is invalid so clicking its tr is prevented by if (!isInvalid).
    // Let's click row index 28 (contact29@domain.com, which is valid)
    const targetRow = screen.getByText('contact29@domain.com').closest('tr');
    fireEvent.click(targetRow, { shiftKey: true });

    // In rows 0 to 28 (29 rows): rows 5, 10, 15, 20, 25 (indices 4, 9, 14, 19, 24) are invalid!
    // That means exactly 24 valid rows should be selected, and all 5 invalid rows must NOT be selected!
    expect(screen.getByRole('radio', { name: /Selected 24/i })).toBeInTheDocument();

    // Verify invalid rows on Page 2 are not selected
    // row index 24 (contact25@domain.com) is invalid on page 1.
    // row index 29 (contact30@domain.com) is invalid on page 2.
    // Verify row 28 (contact29@domain.com) is selected
    expect(targetRow).toHaveClass('row-selected');

    // Return to Page 1 and check that invalid row 5 (contact5@domain.com) is NOT selected
    const prevBtn = screen.getByRole('button', { name: 'Previous Page' });
    fireEvent.click(prevBtn);
    const invalidRow5 = screen.getByText('contact5@domain.com').closest('tr');
    expect(invalidRow5).toHaveClass('row-invalid');
    expect(invalidRow5).not.toHaveClass('row-selected');
  });

  it('supports reverse Shift-click selection from Page 2 back to Page 1', () => {
    const rows = makeRows(60, { preSelected: false });
    renderModalWithData(makeSheetData(rows));

    const nextBtn = screen.getByRole('button', { name: 'Next Page' });
    const prevBtn = screen.getByRole('button', { name: 'Previous Page' });

    // Advance to Page 2 first
    fireEvent.click(nextBtn);
    expect(screen.getByText('26–50', { selector: 'strong' })).toBeInTheDocument();

    // Click contact30@domain.com (index 29) on Page 2 without shift
    const row30 = screen.getByText('contact30@domain.com').closest('tr');
    fireEvent.click(row30);
    expect(row30).toHaveClass('row-selected');
    expect(screen.getByRole('radio', { name: /Selected 1/i })).toBeInTheDocument();

    // Navigate back to Page 1
    fireEvent.click(prevBtn);
    expect(screen.getByText('1–25', { selector: 'strong' })).toBeInTheDocument();

    // Shift-click contact10@domain.com (index 9) on Page 1
    const row10 = screen.getByText('contact10@domain.com').closest('tr');
    fireEvent.click(row10, { shiftKey: true });

    // Range from index 9 to index 29 is 21 rows!
    expect(screen.getByRole('radio', { name: /Selected 21/i })).toBeInTheDocument();
    expect(screen.getByText(/Approve & Import 21 Contacts/i)).toBeInTheDocument();
  });

  it('handles regex special characters safely in search input without crashing', () => {
    renderModalWithData(makeSheetData(makeRows(25)));

    const searchInput = screen.getByLabelText('Search contacts');
    // Regex metacharacters that would crash RegExp if unescaped
    fireEvent.change(searchInput, { target: { value: '[[**((foo\\\\))' } });

    expect(screen.getByText('No contacts matching your search/filter criteria.')).toBeInTheDocument();
    expect(screen.getByText((_, el) => el?.tagName === 'SPAN' && el.textContent.includes('Showing 0 of 0 rows'))).toBeInTheDocument();
  });

  it('clamps page back to 1 when switching between filter tabs', () => {
    const rows = makeRows(60, { preSelected: false });
    // Make only 2 contacts invalid
    rows[2].isValidEmail = false;
    rows[3].isValidEmail = false;

    renderModalWithData(makeSheetData(rows));

    const nextBtn = screen.getByRole('button', { name: 'Next Page' });
    // Advance to Page 3
    fireEvent.click(nextBtn);
    fireEvent.click(nextBtn);
    expect(screen.getByText((_, el) => el?.tagName === 'SPAN' && el.textContent.includes('Page') && el.textContent.includes('3 of 3'))).toBeInTheDocument();

    // Click Needs attention / Invalid tab
    const attentionTab = screen.getByRole('radio', { name: /Needs attention 2/i });
    fireEvent.click(attentionTab);

    // Clamps back to Page 1
    expect(screen.getByText((_, el) => el?.tagName === 'SPAN' && el.textContent.includes('Page') && el.textContent.includes('1 of 1'))).toBeInTheDocument();
    expect(screen.getByText('1–2', { selector: 'strong' })).toBeInTheDocument();
  });
});

describe('RecipientManager Queue Pagination & 30-Day Dedup Stress Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchOutreachLogs.mockResolvedValue([]);
  });

  const makeQueueRecipients = (count) => {
    return Array.from({ length: count }, (_, i) => ({
      id: `rec_${i + 1}`,
      name: `Lead ${i + 1}`,
      email: `lead${i + 1}@corp.com`,
      company: `Corp ${i + 1}`,
      role: 'Hiring Lead',
      jobDescription: '',
      isValidEmail: true,
      isSelected: false,
      isApproved: true,
      status: 'pending'
    }));
  };

  it('queue pagination boundary with 9 cards: displays all on 1 page with disabled controls', async () => {
    await act(async () => {
      render(
        <RecipientManager
          recipients={makeQueueRecipients(9)}
          onUpdateRecipients={vi.fn()}
          onShowToast={vi.fn()}
        />
      );
    });

    expect(screen.getByText('1–9', { selector: 'strong' })).toBeInTheDocument();
    expect(screen.getByText(/of 9/)).toBeInTheDocument();
    expect(screen.getByText('Page 1 of 1')).toBeInTheDocument();

    const prevBtn = screen.getByRole('button', { name: 'Previous queue page' });
    const nextBtn = screen.getByRole('button', { name: 'Next queue page' });
    expect(prevBtn).toBeDisabled();
    expect(nextBtn).toBeDisabled();
  });

  it('queue pagination boundary with 10 cards: displays exactly 10 on 1 page with disabled controls', async () => {
    await act(async () => {
      render(
        <RecipientManager
          recipients={makeQueueRecipients(10)}
          onUpdateRecipients={vi.fn()}
          onShowToast={vi.fn()}
        />
      );
    });

    expect(screen.getByText('lead1@corp.com')).toBeInTheDocument();
    expect(screen.getByText('lead10@corp.com')).toBeInTheDocument();
    expect(screen.getByText('1–10', { selector: 'strong' })).toBeInTheDocument();
    expect(screen.getByText(/of 10/)).toBeInTheDocument();
    expect(screen.getByText('Page 1 of 1')).toBeInTheDocument();

    const prevBtn = screen.getByRole('button', { name: 'Previous queue page' });
    const nextBtn = screen.getByRole('button', { name: 'Next queue page' });
    expect(prevBtn).toBeDisabled();
    expect(nextBtn).toBeDisabled();
  });

  it('queue pagination boundary with 11 cards: splits across 2 pages (10 on page 1, 1 on page 2)', async () => {
    await act(async () => {
      render(
        <RecipientManager
          recipients={makeQueueRecipients(11)}
          onUpdateRecipients={vi.fn()}
          onShowToast={vi.fn()}
        />
      );
    });

    // Page 1
    expect(screen.getByText('lead1@corp.com')).toBeInTheDocument();
    expect(screen.getByText('lead10@corp.com')).toBeInTheDocument();
    expect(screen.queryByText('lead11@corp.com')).not.toBeInTheDocument();
    expect(screen.getByText('1–10', { selector: 'strong' })).toBeInTheDocument();
    expect(screen.getByText(/of 11/)).toBeInTheDocument();
    expect(screen.getByText('Page 1 of 2')).toBeInTheDocument();

    const prevBtn = screen.getByRole('button', { name: 'Previous queue page' });
    const nextBtn = screen.getByRole('button', { name: 'Next queue page' });
    expect(prevBtn).toBeDisabled();
    expect(nextBtn).not.toBeDisabled();

    // Advance to Page 2
    fireEvent.click(nextBtn);
    expect(screen.queryByText('lead1@corp.com')).not.toBeInTheDocument();
    expect(screen.queryByText('lead10@corp.com')).not.toBeInTheDocument();
    expect(screen.getByText('lead11@corp.com')).toBeInTheDocument();
    expect(screen.getByText('11–11', { selector: 'strong' })).toBeInTheDocument();
    expect(screen.getByText(/of 11/)).toBeInTheDocument();
    expect(screen.getByText('Page 2 of 2')).toBeInTheDocument();
    expect(prevBtn).not.toBeDisabled();
    expect(nextBtn).toBeDisabled();

    // Retreat to Page 1
    fireEvent.click(prevBtn);
    expect(screen.getByText('lead1@corp.com')).toBeInTheDocument();
    expect(screen.queryByText('lead11@corp.com')).not.toBeInTheDocument();
    expect(screen.getByText('1–10', { selector: 'strong' })).toBeInTheDocument();
  });

  it('enforces case-insensitive 30-day deduplication (uppercase log vs lowercase input)', async () => {
    const recentTimestamp = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
    fetchOutreachLogs.mockResolvedValueOnce([
      {
        recipientEmail: 'ALICE@EXAMPLE.COM',
        status: 'sent',
        timestamp: recentTimestamp,
        company: 'UpperCorp'
      }
    ]);

    const onUpdateRecipients = vi.fn();
    render(
      <RecipientManager
        recipients={[]}
        onUpdateRecipients={onUpdateRecipients}
        onShowToast={vi.fn()}
      />
    );

    await act(async () => {
      await Promise.resolve();
    });

    // Switch to Add Manually
    fireEvent.click(screen.getByRole('button', { name: /Add Manually/i }));

    // Input lowercase email
    fireEvent.change(screen.getByPlaceholderText('e.g. Jessica Taylor'), {
      target: { value: 'Alice Lower' }
    });
    fireEvent.change(screen.getByPlaceholderText('e.g. jessica@company.com'), {
      target: { value: 'alice@example.com' }
    });

    // Submit form
    fireEvent.click(screen.getByRole('button', { name: /Add Recipient to Queue/i }));

    // 30-day warning banner must trigger case-insensitively
    expect(screen.getByText(/Contacted on/i)).toBeInTheDocument();
    expect(screen.getByText(/UpperCorp/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Yes, Add' })).toBeInTheDocument();
    expect(onUpdateRecipients).not.toHaveBeenCalled();
  });

  it('enforces case-insensitive 30-day deduplication (lowercase log vs uppercase input)', async () => {
    const recentTimestamp = new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString();
    fetchOutreachLogs.mockResolvedValueOnce([
      {
        recipientEmail: 'bob@example.com',
        status: 'sent',
        timestamp: recentTimestamp,
        company: 'LowerCorp'
      }
    ]);

    const onUpdateRecipients = vi.fn();
    render(
      <RecipientManager
        recipients={[]}
        onUpdateRecipients={onUpdateRecipients}
        onShowToast={vi.fn()}
      />
    );

    await act(async () => {
      await Promise.resolve();
    });

    // Switch to Add Manually
    fireEvent.click(screen.getByRole('button', { name: /Add Manually/i }));

    // Input uppercase email
    fireEvent.change(screen.getByPlaceholderText('e.g. Jessica Taylor'), {
      target: { value: 'Bob Upper' }
    });
    fireEvent.change(screen.getByPlaceholderText('e.g. jessica@company.com'), {
      target: { value: 'BOB@EXAMPLE.COM' }
    });

    // Submit form
    fireEvent.click(screen.getByRole('button', { name: /Add Recipient to Queue/i }));

    // 30-day warning banner must trigger case-insensitively
    expect(screen.getByText(/Contacted on/i)).toBeInTheDocument();
    expect(screen.getByText(/LowerCorp/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Yes, Add' })).toBeInTheDocument();
    expect(onUpdateRecipients).not.toHaveBeenCalled();
  });

  it('confirms manual duplicate with "Yes, Add" and verifies "Previously Contacted" badge persists in queue', async () => {
    const recentTimestamp = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
    fetchOutreachLogs.mockResolvedValueOnce([
      {
        recipientEmail: 'persisted@company.com',
        status: 'sent',
        timestamp: recentTimestamp,
        company: 'Acme Persist'
      }
    ]);

    let currentRecipients = [];
    const onUpdateRecipients = vi.fn((newRecipients) => {
      currentRecipients = newRecipients;
    });

    const { rerender } = render(
      <RecipientManager
        recipients={currentRecipients}
        onUpdateRecipients={onUpdateRecipients}
        onShowToast={vi.fn()}
      />
    );

    await act(async () => {
      await Promise.resolve();
    });

    // Switch to Add Manually
    fireEvent.click(screen.getByRole('button', { name: /Add Manually/i }));

    fireEvent.change(screen.getByPlaceholderText('e.g. Jessica Taylor'), {
      target: { value: 'Persisted User' }
    });
    fireEvent.change(screen.getByPlaceholderText('e.g. jessica@company.com'), {
      target: { value: 'PERSISTED@COMPANY.COM' }
    });

    // Trigger warning
    fireEvent.click(screen.getByRole('button', { name: /Add Recipient to Queue/i }));
    expect(screen.getByText(/Contacted on/i)).toBeInTheDocument();

    // Confirm addition
    const confirmBtn = screen.getByRole('button', { name: 'Yes, Add' });
    fireEvent.click(confirmBtn);

    expect(onUpdateRecipients).toHaveBeenCalledTimes(1);
    const addedRecipient = currentRecipients[0];
    expect(addedRecipient.email).toBe('PERSISTED@COMPANY.COM');
    expect(addedRecipient.isPreviouslyContacted).toBe(true);
    expect(addedRecipient.lastContactedDate).toBe(recentTimestamp);

    // Re-render component with updated recipients list
    rerender(
      <RecipientManager
        recipients={currentRecipients}
        onUpdateRecipients={onUpdateRecipients}
        onShowToast={vi.fn()}
      />
    );

    // Verify "Previously Contacted" badge appears on the queue card
    const badge = screen.getByText('Previously Contacted');
    expect(badge).toBeInTheDocument();
    expect(badge.closest('.status-badge-attention')).toBeInTheDocument();
  });

  it('clamps queue page back to 1 upon search query in RecipientManager', async () => {
    await act(async () => {
      render(
        <RecipientManager
          recipients={makeQueueRecipients(25)}
          onUpdateRecipients={vi.fn()}
          onShowToast={vi.fn()}
        />
      );
    });

    const nextBtn = screen.getByRole('button', { name: 'Next queue page' });
    // Advance to Page 3 (21-25)
    fireEvent.click(nextBtn);
    fireEvent.click(nextBtn);
    expect(screen.getByText('21–25', { selector: 'strong' })).toBeInTheDocument();
    expect(screen.getByText('Page 3 of 3')).toBeInTheDocument();

    // Type in search box to filter to single contact
    const searchInput = screen.getByPlaceholderText('Search recipients by name, email, company, role...');
    fireEvent.change(searchInput, { target: { value: 'lead2' } });

    // Page must clamp back to Page 1
    expect(screen.getByText('Page 1 of', { exact: false })).toBeInTheDocument();
    expect(screen.getByText('1–', { exact: false })).toBeInTheDocument();

    // Clear search clamps back to 1 of 3
    fireEvent.change(searchInput, { target: { value: '' } });
    expect(screen.getByText('Page 1 of 3')).toBeInTheDocument();
    expect(screen.getByText('1–10', { selector: 'strong' })).toBeInTheDocument();
  });

  it('distinguishes between 29-day recent contact (triggers warning) and 31-day expired contact (no warning)', async () => {
    const twentyNineDaysAgo = new Date(Date.now() - 29 * 24 * 60 * 60 * 1000).toISOString();
    const thirtyOneDaysAgo = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString();

    fetchOutreachLogs.mockResolvedValueOnce([
      {
        recipientEmail: 'recent@corp.com',
        status: 'sent',
        timestamp: twentyNineDaysAgo,
        company: 'RecentCorp'
      },
      {
        recipientEmail: 'expired@corp.com',
        status: 'sent',
        timestamp: thirtyOneDaysAgo,
        company: 'OldCorp'
      }
    ]);

    const onUpdateRecipients = vi.fn();
    render(
      <RecipientManager
        recipients={[]}
        onUpdateRecipients={onUpdateRecipients}
        onShowToast={vi.fn()}
      />
    );

    await act(async () => {
      await Promise.resolve();
    });

    fireEvent.click(screen.getByRole('button', { name: /Add Manually/i }));

    // Test 1: expired contact (>30 days) -> should NOT trigger warning banner and should add immediately
    fireEvent.change(screen.getByPlaceholderText('e.g. Jessica Taylor'), { target: { value: 'Old Contact' } });
    fireEvent.change(screen.getByPlaceholderText('e.g. jessica@company.com'), { target: { value: 'expired@corp.com' } });
    fireEvent.click(screen.getByRole('button', { name: /Add Recipient to Queue/i }));

    expect(screen.queryByText(/Contacted on/i)).not.toBeInTheDocument();
    expect(onUpdateRecipients).toHaveBeenCalledTimes(1);

    // Test 2: recent contact (29 days) -> SHOULD trigger warning banner
    fireEvent.change(screen.getByPlaceholderText('e.g. Jessica Taylor'), { target: { value: 'Recent Contact' } });
    fireEvent.change(screen.getByPlaceholderText('e.g. jessica@company.com'), { target: { value: 'recent@corp.com' } });
    fireEvent.click(screen.getByRole('button', { name: /Add Recipient to Queue/i }));

    expect(screen.getByText(/Contacted on/i)).toBeInTheDocument();
    expect(screen.getByText(/RecentCorp/i)).toBeInTheDocument();
    expect(onUpdateRecipients).toHaveBeenCalledTimes(1); // not called again
  });

  it('ignores failed or non-sent outreach records in 30-day deduplication', async () => {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    fetchOutreachLogs.mockResolvedValueOnce([
      {
        recipientEmail: 'failed@corp.com',
        status: 'failed',
        timestamp: yesterday,
        company: 'FailedCorp'
      },
      {
        recipientEmail: 'bounced@corp.com',
        status: 'bounced',
        timestamp: yesterday,
        company: 'BouncedCorp'
      }
    ]);

    const onUpdateRecipients = vi.fn();
    render(
      <RecipientManager
        recipients={[]}
        onUpdateRecipients={onUpdateRecipients}
        onShowToast={vi.fn()}
      />
    );

    await act(async () => {
      await Promise.resolve();
    });

    fireEvent.click(screen.getByRole('button', { name: /Add Manually/i }));

    // Add failed contact: should NOT show warning banner
    fireEvent.change(screen.getByPlaceholderText('e.g. Jessica Taylor'), { target: { value: 'Failed User' } });
    fireEvent.change(screen.getByPlaceholderText('e.g. jessica@company.com'), { target: { value: 'failed@corp.com' } });
    fireEvent.click(screen.getByRole('button', { name: /Add Recipient to Queue/i }));

    expect(screen.queryByText(/Contacted on/i)).not.toBeInTheDocument();
    expect(onUpdateRecipients).toHaveBeenCalledTimes(1);
  });

  it('handles mixed casing with surrounding whitespace in 30-day dedup matching', async () => {
    const recentTimestamp = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString();
    fetchOutreachLogs.mockResolvedValueOnce([
      {
        recipientEmail: '  Whitespace.Contact@Domain.Com  ',
        status: 'sent',
        timestamp: recentTimestamp,
        company: 'PaddedCorp'
      }
    ]);

    const onUpdateRecipients = vi.fn();
    render(
      <RecipientManager
        recipients={[]}
        onUpdateRecipients={onUpdateRecipients}
        onShowToast={vi.fn()}
      />
    );

    await act(async () => {
      await Promise.resolve();
    });

    fireEvent.click(screen.getByRole('button', { name: /Add Manually/i }));

    fireEvent.change(screen.getByPlaceholderText('e.g. Jessica Taylor'), { target: { value: 'Padded' } });
    fireEvent.change(screen.getByPlaceholderText('e.g. jessica@company.com'), { target: { value: ' whitespace.contact@domain.com ' } });
    fireEvent.click(screen.getByRole('button', { name: /Add Recipient to Queue/i }));

    expect(screen.getByText(/Contacted on/i)).toBeInTheDocument();
    expect(screen.getByText(/PaddedCorp/i)).toBeInTheDocument();
    expect(onUpdateRecipients).not.toHaveBeenCalled();
  });
});
