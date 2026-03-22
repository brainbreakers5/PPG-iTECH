import Swal from 'sweetalert2';

export const choosePrintMode = async (documentLabel = 'this report') => {
    const result = await Swal.fire({
        title: 'Choose output',
        text: `How would you like to open ${documentLabel}?`,
        icon: 'question',
        showCancelButton: true,
        showDenyButton: true,
        confirmButtonText: 'Print',
        denyButtonText: 'Download PDF',
        cancelButtonText: 'Cancel',
        confirmButtonColor: '#2563eb',
        denyButtonColor: '#475569',
        cancelButtonColor: '#94a3b8'
    });

    if (result.isConfirmed) return 'print';
    if (result.isDenied) return 'pdf';
    return null;
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
        if (mode === 'pdf') {
            printWindow.document.title = `${title} - PDF`;
        }
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
    closeAfterPrint = false
}) => {
    if (!printWindow) return false;

    const mode = await choosePrintMode(modeLabel);
    if (!mode) {
        printWindow.close();
        return false;
    }

    printWindow.focus();
    setTimeout(() => {
        if (mode === 'pdf') {
            printWindow.document.title = `${title} - PDF`;
        }
        printWindow.print();
        if (closeAfterPrint) {
            printWindow.close();
        }
    }, delay);

    return true;
};
