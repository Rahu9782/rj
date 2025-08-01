
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export const formatAirlangDate = (icaoDate: string): string => {
    if (!/^\d{10}$/.test(icaoDate)) {
        console.error(`Invalid ICAO date format: ${icaoDate}`);
        return "INVALID_DATE";
    }
    
    const yearStr = icaoDate.substring(0, 2);
    const monthIndex = parseInt(icaoDate.substring(2, 4), 10) - 1;
    const day = icaoDate.substring(4, 6);
    const hour = icaoDate.substring(6, 8);
    const minute = icaoDate.substring(8, 10);
    
    // Simple logic to determine century, assumes 2000s
    const fullYear = `20${yearStr}`;
    const month = MONTHS[monthIndex] || 'Unk';

    return `${day} ${month} ${fullYear} ${hour}:${minute}`;
};
