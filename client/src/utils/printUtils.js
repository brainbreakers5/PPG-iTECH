import Swal from 'sweetalert2';
import * as XLSX from 'xlsx';

const DEFAULT_PRINT_PAGINATION_CSS = `
<style id="global-print-pagination-fix">
    html, body {
        height: auto !important;
        overflow: visible !important;
    }
    table {
        width: 100%;
        border-collapse: collapse;
        table-layout: auto;
    }
    thead { display: table-header-group; }
    tfoot { display: table-footer-group; }
    tr, td, th, img, svg, .print-avoid-break {
        break-inside: avoid;
        page-break-inside: avoid;
    }
    .print-allow-break {
        break-inside: auto;
        page-break-inside: auto;
    }
    @media print {
        html, body {
            height: auto !important;
            overflow: visible !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
        }
        .print-page {
            break-after: page;
            page-break-after: always;
        }
        .print-page:last-child {
            break-after: auto;
            page-break-after: auto;
        }
    }
</style>`;

const withPrintPaginationCss = (html) => {
    const raw = String(html || '');
    if (!raw) return raw;
    if (raw.includes('global-print-pagination-fix')) return raw;

    if (/<head[^>]*>/i.test(raw)) {
        return raw.replace(/<head[^>]*>/i, (match) => `${match}${DEFAULT_PRINT_PAGINATION_CSS}`);
    }

    if (/<html[^>]*>/i.test(raw)) {
        return raw.replace(/<html[^>]*>/i, (match) => `${match}<head>${DEFAULT_PRINT_PAGINATION_CSS}</head>`);
    }

    return `<!doctype html><html><head>${DEFAULT_PRINT_PAGINATION_CSS}</head><body>${raw}</body></html>`;
};

const printWithHiddenIframe = ({ html, title, delay = 250, closeAfterPrint = true }) => {
    return new Promise((resolve) => {
        const iframe = document.createElement('iframe');
        iframe.style.position = 'fixed';
        iframe.style.right = '0';
        iframe.style.bottom = '0';
        iframe.style.width = '0';
        iframe.style.height = '0';
        iframe.style.border = '0';
        iframe.style.visibility = 'hidden';

        iframe.onload = () => {
            const frameWindow = iframe.contentWindow;
            if (!frameWindow) {
                document.body.removeChild(iframe);
                resolve(false);
                return;
            }

            try {
                frameWindow.document.title = title;
            } catch {
                // Ignore title assignment errors.
            }

            setTimeout(() => {
                frameWindow.focus();
                frameWindow.print();
                if (closeAfterPrint) {
                    setTimeout(() => {
                        if (document.body.contains(iframe)) {
                            document.body.removeChild(iframe);
                        }
                    }, 300);
                }
                resolve(true);
            }, delay);
        };

        document.body.appendChild(iframe);
        const doc = iframe.contentDocument || iframe.contentWindow?.document;
        if (!doc) {
            if (document.body.contains(iframe)) {
                document.body.removeChild(iframe);
            }
            resolve(false);
            return;
        }

        doc.open();
        doc.write(withPrintPaginationCss(html));
        doc.close();
    });
};

const sanitizeFileName = (value, fallback = 'report') => {
    const base = String(value || fallback)
        .trim()
        .replace(/[\\/:*?"<>|]+/g, '-')
        .replace(/\s+/g, ' ')
        .slice(0, 80);
    return (base || fallback).replace(/\s+/g, '_');
};

const parseTableFromHtml = (html) => {
    const doc = new DOMParser().parseFromString(String(html || ''), 'text/html');
    const table = doc.querySelector('table');
    if (!table) return [];

    const rows = [];
    table.querySelectorAll('tr').forEach((tr) => {
        const cells = Array.from(tr.querySelectorAll('th, td')).map((cell) => String(cell.textContent || '').trim());
        if (cells.length) rows.push(cells);
    });
    return rows;
};

const downloadExcelFromHtml = ({ html, title }) => {
    const rows = parseTableFromHtml(html);
    if (!rows.length) {
        throw new Error('No tabular data available for Excel export.');
    }

    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Report');
    XLSX.writeFile(wb, `${sanitizeFileName(title)}.xlsx`);
};

const openHtmlPreviewWindow = ({ html, title = 'Report Preview' }) => {
    const previewWindow = window.open('', '_blank', 'width=1200,height=800');
    if (!previewWindow) return false;
    previewWindow.document.write(withPrintPaginationCss(html));
    previewWindow.document.title = `${title} - Preview`;
    previewWindow.document.close();
    previewWindow.focus();
    return true;
};

const buildPdfFromHtml = async ({ html }) => {
    const { jsPDF } = await import('jspdf');

    const doc = new DOMParser().parseFromString(String(html || ''), 'text/html');
    const host = document.createElement('div');
    host.style.position = 'fixed';
    host.style.left = '-10000px';
    host.style.top = '0';
    host.style.width = '1000px';
    host.style.background = '#fff';
    host.innerHTML = doc.body?.innerHTML || String(html || '');
    document.body.appendChild(host);

    try {
        const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
        await pdf.html(host, {
            margin: [30, 20, 30, 20],
            autoPaging: 'text',
            html2canvas: { scale: 0.7, useCORS: true, backgroundColor: '#ffffff' }
        });
        return pdf;
    } finally {
        document.body.removeChild(host);
    }
};

const downloadPdfFromHtml = async ({ html, title }) => {
    const pdf = await buildPdfFromHtml({ html });
    pdf.save(`${sanitizeFileName(title)}.pdf`);
};

const viewPdfFromHtml = async ({ html, title }) => {
    const pdf = await buildPdfFromHtml({ html });
    const blobUrl = pdf.output('bloburl');
    window.open(blobUrl, '_blank', 'noopener,noreferrer');
    return true;
};

const chooseFileAction = async (formatLabel = 'file') => {
    const { isConfirmed, isDenied } = await Swal.fire({
        title: `${formatLabel} Report`,
        text: `Do you want to view the ${formatLabel.toLowerCase()} first or download directly?`,
        icon: 'question',
        showCancelButton: true,
        showDenyButton: true,
        confirmButtonText: 'View',
        denyButtonText: 'Download',
        cancelButtonText: 'Cancel'
    });

    if (isConfirmed) return 'view';
    if (isDenied) return 'download';
    return null;
};

const handleFileReportAction = async ({ mode, html, title }) => {
    if (mode !== 'excel' && mode !== 'pdf') return false;

    const action = await chooseFileAction(mode === 'excel' ? 'Excel' : 'PDF');
    if (!action) return false;

    if (mode === 'excel') {
        if (action === 'download') {
            downloadExcelFromHtml({ html, title });
            return true;
        }

        const opened = openHtmlPreviewWindow({ html, title: String(title || 'Excel Report') });
        if (!opened) throw new Error('Popup blocked while opening Excel preview.');

        const followup = await Swal.fire({
            title: 'Excel Preview Opened',
            text: 'Do you want to download the Excel file now?',
            icon: 'info',
            showCancelButton: true,
            confirmButtonText: 'Download Excel',
            cancelButtonText: 'Keep Preview Only'
        });

        if (followup.isConfirmed) {
            downloadExcelFromHtml({ html, title });
        }
        return true;
    }

    if (action === 'download') {
        await downloadPdfFromHtml({ html, title });
        return true;
    }

    await viewPdfFromHtml({ html, title });
    const followup = await Swal.fire({
        title: 'PDF Preview Opened',
        text: 'Do you want to download the PDF file now?',
        icon: 'info',
        showCancelButton: true,
        confirmButtonText: 'Download PDF',
        cancelButtonText: 'Keep Preview Only'
    });

    if (followup.isConfirmed) {
        await downloadPdfFromHtml({ html, title });
    }
    return true;
};

const shareReport = async ({ html, title }) => {
    const reportTitle = String(title || 'Report');
    const reportText = `${reportTitle} - shared from PPG EMP HUB`;
    const reportUrl = window.location.href;

    const htmlBlob = new Blob([String(html || '')], { type: 'text/html' });
    const htmlFile = new File([htmlBlob], `${sanitizeFileName(reportTitle)}.html`, { type: 'text/html' });

    if (navigator.share) {
        try {
            if (navigator.canShare && navigator.canShare({ files: [htmlFile] })) {
                await navigator.share({ title: reportTitle, text: reportText, files: [htmlFile] });
                return;
            }
            await navigator.share({ title: reportTitle, text: reportText, url: reportUrl });
            return;
        } catch {
            // User cancellation and API errors fall through to manual choices.
        }
    }

    const encodedText = encodeURIComponent(`${reportText}\n${reportUrl}`);
    const encodedSubject = encodeURIComponent(reportTitle);

    const { isConfirmed, isDenied } = await Swal.fire({
        title: 'Share Report',
        text: 'Choose where you want to share this report.',
        icon: 'info',
        showCancelButton: true,
        confirmButtonText: 'WhatsApp',
        denyButtonText: 'Email',
        showDenyButton: true,
        cancelButtonText: 'Copy Link'
    });

    if (isConfirmed) {
        window.open(`https://wa.me/?text=${encodedText}`, '_blank', 'noopener,noreferrer');
        return;
    }
    if (isDenied) {
        window.location.href = `mailto:?subject=${encodedSubject}&body=${encodedText}`;
        return;
    }

    await navigator.clipboard?.writeText(`${reportText}\n${reportUrl}`);
    await Swal.fire({ icon: 'success', title: 'Copied', text: 'Report link copied to clipboard.', timer: 1500, showConfirmButton: false });
};

export const choosePrintMode = async (documentLabel = 'this report') => {
    const { isConfirmed, value } = await Swal.fire({
        title: 'Generate Report',
        text: `How do you want to generate ${documentLabel}?`,
        input: 'radio',
        inputOptions: {
            print: 'Print Page',
            excel: 'Excel (.xlsx)',
            pdf: 'PDF (.pdf)',
            share: 'Share'
        },
        inputValue: 'print',
        showCancelButton: true,
        confirmButtonText: 'Continue'
    });

    if (!isConfirmed) return null;
    return value || 'print';
};

export const runPrintWindow = async ({
    title,
    html,
    windowFeatures = 'width=1200,height=800',
    delay = 250,
    modeLabel = 'this report',
    closeAfterPrint = false
}) => {
    const mode = await choosePrintMode(modeLabel);
    if (!mode) return false;

    if (mode === 'excel' || mode === 'pdf' || mode === 'share') {
        try {
            if (mode === 'excel' || mode === 'pdf') {
                await handleFileReportAction({ mode, html, title });
            } else {
                await shareReport({ html, title });
            }
            return true;
        } catch (error) {
            await Swal.fire({
                icon: 'error',
                title: 'Report action failed',
                text: error?.message || 'Unable to complete this report action right now.'
            });
            return false;
        }
    }

    const printWindow = window.open('', '_blank', windowFeatures);
    if (!printWindow) {
        return await printWithHiddenIframe({ html, title, delay, closeAfterPrint });
    }

    printWindow.document.write(withPrintPaginationCss(html));
    printWindow.document.close();
    printWindow.focus();

    setTimeout(() => {
        printWindow.print();
        if (closeAfterPrint) {
            printWindow.close();
        }
    }, delay);

    return true;
};

export const finalizePrintWindow = async ({
    printWindow,
    title,
    delay = 250,
    modeLabel = 'this report',
    closeAfterPrint = false,
    windowFeatures = 'width=1200,height=800'
}) => {
    if (!printWindow) return false;

    // Preserve the prepared document, then reopen only after user picks output mode.
    const preparedHtml = printWindow.document?.documentElement
        ? withPrintPaginationCss(`<!doctype html>${printWindow.document.documentElement.outerHTML}`)
        : null;

    const inferredFeatures = `width=${printWindow.outerWidth || 1200},height=${printWindow.outerHeight || 800}`;

    try {
        printWindow.close();
    } catch {
        // Ignore close errors and continue.
    }

    if (!preparedHtml) return false;

    const mode = await choosePrintMode(modeLabel);
    if (!mode) return false;

    if (mode === 'excel' || mode === 'pdf' || mode === 'share') {
        try {
            if (mode === 'excel' || mode === 'pdf') {
                await handleFileReportAction({ mode, html: preparedHtml, title });
            } else {
                await shareReport({ html: preparedHtml, title });
            }
            return true;
        } catch (error) {
            await Swal.fire({
                icon: 'error',
                title: 'Report action failed',
                text: error?.message || 'Unable to complete this report action right now.'
            });
            return false;
        }
    }

    const targetWindow = window.open('', '_blank', windowFeatures || inferredFeatures);
    if (!targetWindow) {
        return await printWithHiddenIframe({ html: preparedHtml, title, delay, closeAfterPrint });
    }

    targetWindow.document.write(withPrintPaginationCss(preparedHtml));
    targetWindow.document.close();
    targetWindow.focus();

    setTimeout(() => {
        targetWindow.print();
        if (closeAfterPrint) {
            targetWindow.close();
        }
    }, delay);

    return true;
};
