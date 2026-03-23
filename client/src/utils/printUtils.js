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
        doc.write(html);
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

    printWindow.document.write(html);
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
        ? `<!doctype html>${printWindow.document.documentElement.outerHTML}`
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

    targetWindow.document.write(preparedHtml);
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
