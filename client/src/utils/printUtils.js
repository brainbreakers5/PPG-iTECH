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

export const choosePrintMode = async (documentLabel = 'this report') => {
    return 'print';
};

export const runPrintWindow = async ({
    title,
    html,
    windowFeatures = 'width=1200,height=800',
    delay = 250,
    modeLabel = 'this report',
    closeAfterPrint = false
}) => {
    const mode = 'print';

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

    const mode = 'print';

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
