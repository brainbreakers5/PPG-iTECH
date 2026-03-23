import Swal from 'sweetalert2';

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
        await Swal.fire({
            title: 'Popup blocked',
            text: 'Please allow popups to continue printing.',
            icon: 'warning',
            confirmButtonColor: '#2563eb'
        });
        return false;
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
        await Swal.fire({
            title: 'Popup blocked',
            text: 'Please allow popups to continue printing.',
            icon: 'warning',
            confirmButtonColor: '#2563eb'
        });
        return false;
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
