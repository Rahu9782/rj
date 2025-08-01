
import { GoogleGenAI, Type } from "@google/genai";
import { ParsedNotam, NotamType } from '../types';

if (!process.env.API_KEY) {
    throw new Error("API_KEY environment variable not set");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const scheduleEntrySchema = {
    type: Type.OBJECT,
    properties: {
        day: { type: Type.NUMBER, description: "The day of the month as a number." },
        month: { type: Type.STRING, description: "The 3-letter uppercase abbreviation of the month (e.g., JAN, FEB, MAR)." },
        startTime: { type: Type.STRING, description: "The start time in HHMM format." },
        endTime: { type: Type.STRING, description: "The end time in HHMM format." },
    },
    required: ["day", "month", "startTime", "endTime"]
};

const recurringScheduleClauseSchema = {
    type: Type.OBJECT,
    properties: {
        day: { type: Type.STRING, description: "A 3-letter uppercase day abbreviation (e.g., 'MON')." },
        startTime: { type: Type.STRING, description: "The start time for this day in HHMM format." },
        endTime: { type: Type.STRING, description: "The end time for this day in HHMM format." },
    },
    required: ["day", "startTime", "endTime"]
};

const recurringScheduleSchema = {
    type: Type.OBJECT,
    properties: {
        timeDefName: { type: Type.STRING, description: "A specific name for the TIMEDEF, often from a supplement (e.g., 'SUP028').", nullable: true },
        clauses: { 
            type: Type.ARRAY,
            description: "An array of schedule clauses, one for each specified day and time.",
            items: recurringScheduleClauseSchema
        },
    },
    required: ["clauses"]
};

const timeRangeSchema = {
    type: Type.OBJECT,
    properties: {
        startTime: { type: Type.STRING, description: "The start time in HHMM format." },
        endTime: { type: Type.STRING, description: "The end time in HHMM format." },
    },
    required: ["startTime", "endTime"]
};

const complexScheduleDateRangeSchema = {
    type: Type.OBJECT,
    properties: {
        startDay: { type: Type.NUMBER, description: "The starting day of a date range." },
        endDay: { type: Type.NUMBER, description: "The ending day of a date range. For a single day, this is the same as startDay." },
    },
    required: ["startDay", "endDay"]
};

const complexScheduleSchema = {
    type: Type.OBJECT,
    properties: {
        dateRanges: {
            type: Type.ARRAY,
            description: "An array of date ranges (e.g., from '24-25 29-30'). A single day like '26' should be a range from 26 to 26.",
            items: complexScheduleDateRangeSchema
        },
        timeRanges: {
            type: Type.ARRAY,
            description: "An array of time ranges that apply to all specified date ranges, sorted chronologically.",
            items: timeRangeSchema
        }
    },
    required: ["dateRanges", "timeRanges"]
};

const detailedScheduleEntrySchema = {
    type: Type.OBJECT,
    properties: {
        day: { type: Type.NUMBER, description: "The day of the month for this schedule entry." },
        timeRanges: {
            type: Type.ARRAY,
            description: "An array of time ranges that apply to this specific day.",
            items: timeRangeSchema
        }
    },
    required: ["day", "timeRanges"]
};

const dailyScheduleWithRangesEntrySchema = {
    type: Type.OBJECT,
    properties: {
        month: { 
            type: Type.STRING, 
            description: "The 3-letter uppercase abbreviation for the month (e.g., 'JUL') if specified in the schedule line itself. Must be populated if present.",
            nullable: true 
        },
        startDay: { type: Type.NUMBER, description: "The start day of the entry. For a single day, this is the day number." },
        endDay: { type: Type.NUMBER, description: "The end day of the entry. For a single day, this is the same as startDay." },
        timeRanges: {
            type: Type.ARRAY,
            description: "An array of time ranges that apply to this specific day or date range.",
            items: timeRangeSchema
        }
    },
    required: ["startDay", "endDay", "timeRanges"]
};

const circleDefinitionSchema = {
    type: Type.OBJECT,
    properties: {
        center: { type: Type.STRING, description: "The center coordinate of the circle, formatted as a single string like '380930N0013321W'." },
        radiusNM: { type: Type.NUMBER, description: "The radius of the circle in nautical miles (NM)." }
    },
    required: ["center", "radiusNM"]
};

const areaDefinitionSchema = {
    type: Type.OBJECT,
    properties: {
        polygon: {
            type: Type.ARRAY,
            description: "For polygon areas, an array of coordinate strings (e.g., '554500N0191800E').",
            items: { type: Type.STRING },
            nullable: true
        },
        circle: {
            ...circleDefinitionSchema,
            description: "For circular areas, an object defining the center and radius.",
            nullable: true
        },
        upperAltitudeFeet: {
            type: Type.NUMBER,
            description: "The upper vertical limit in FEET. Extract from field G). Convert Flight Levels (FL) to feet (1 FL = 100 feet). E.g., 'FL250' is 25000 feet. '12500FT AMSL' is 12500 feet.",
        },
        lowerAltitudeFeet: {
            type: Type.NUMBER,
            description: "The lower vertical limit in FEET. Extract from field F). 'SFC' or 'GND' is 0 feet. E.g. '10000FT AMSL' is 10000 feet.",
        }
    },
    required: ["upperAltitudeFeet", "lowerAltitudeFeet"]
};


const responseSchema = {
    type: Type.OBJECT,
    properties: {
        notamId: {
            type: Type.STRING,
            description: "The unique identifier for the NOTAM, from the first line (e.g., 'X9117/25').",
            nullable: true,
        },
        aerodromes: {
            type: Type.ARRAY,
            description: "An array of 4-letter ICAO codes of the aerodromes affected (from field A).",
            items: { type: Type.STRING },
            nullable: true
        },
        startTime: {
            type: Type.STRING,
            description: "The start time from field B) in YYMMDDHHMM format.",
            nullable: true
        },
        endTime: {
            type: Type.STRING,
            description: "The end time from field C) in YYMMDDHHMM format.",
            nullable: true
        },
        parsedSchedule: {
            type: Type.ARRAY,
            description: "Use for non-recurring schedules, especially lists of specific dates and times (e.g., '01 NOV 1000-1200, 03 NOV 1400-1600'). This should also be used for complex multi-line schedules where days are grouped by month and time (e.g., 'AUG 01 03 05 1000-1200').",
            items: scheduleEntrySchema,
            nullable: true
        },
        recurringSchedule: {
            ...recurringScheduleSchema,
            description: "Use for recurring schedules like 'DAILY HHMM-HHMM' or specific days of the week (e.g., 'MON-FRI') from field D).",
            nullable: true,
        },
        multiTimeRangeSchedule: {
            type: Type.ARRAY,
            description: "Use when field D) contains multiple standalone time slots for the same day(s) (e.g., '1300-1700 1900-2000').",
            items: timeRangeSchema,
            nullable: true
        },
        complexSchedule: {
            ...complexScheduleSchema,
            description: "Use for schedules combining date ranges with multiple time slots (e.g., 'D) 24-25 29-30 0530-0645 0800-0900').",
            nullable: true,
        },
        detailedSchedule: {
            type: Type.ARRAY,
            description: "Use for formats like 'D) 01 2100-2359, 02 0000-1100 2100-2359', where each day has specific time ranges.",
            items: detailedScheduleEntrySchema,
            nullable: true
        },
        dailyScheduleWithRanges: {
            type: Type.ARRAY,
            description: "Use for schedules mixing single days and date ranges, each with their own times, especially when a month is specified. E.g., 'D) 01 2200-2359, 02-05 0000-0800' or 'E) JUL 29-30 0530-2100'.",
            items: dailyScheduleWithRangesEntrySchema,
            nullable: true
        },
        notamType: {
            type: Type.STRING,
            enum: Object.values(NotamType),
            description: "The classified type of the NOTAM.",
        },
        affectedElement: {
            type: Type.STRING,
            description: "The specific runway, taxiway, navaid, or apron affected. (e.g., '05/23', 'TWY A', 'ILS').",
            nullable: true
        },
        reason: {
            type: Type.STRING,
            description: "A brief reason for the NOTAM if available (e.g., 'WIP', 'MAINTENANCE', 'U/S').",
            nullable: true
        },
        airspaceType: {
            type: Type.STRING,
            description: "The type of pre-defined airspace affected (e.g., 'DANGER', 'RESTRICTED').",
            nullable: true
        },
        airspaceId: {
            type: Type.STRING,
            description: "The identifier of the pre-defined airspace (e.g., 'CYR123').",
            nullable: true
        },
        areaDefinitions: {
            type: Type.ARRAY,
            description: "An array of area definitions for complex airspace activations like DANGER or MILITARY areas.",
            items: areaDefinitionSchema,
            nullable: true
        }
    },
    required: ["notamType"]
};

const systemInstruction = `You are an expert aviation NOTAM parser. Your task is to analyze a raw ICAO-style NOTAM and extract key information into a structured JSON format, strictly following the provided schema.

**Core Instructions:**
1.  **Classification (\`notamType\`)**: This is your most critical task.
    -   If field E) defines a temporary area with coordinates and does NOT explicitly say 'DANGER AREA' or 'MILITARY', you MUST classify it as \`${NotamType.RESTRICTED_AREA_ACTIVATION}\` and populate \`areaDefinitions\`.
    -   Use \`${NotamType.DANGER_AREA_ACTIVATION}\` only when "DANGER AREA" is explicitly mentioned.
    -   Use \`${NotamType.AIRSPACE_ACTIVATION}\` only for pre-defined, named airspaces (e.g., 'CYR123 ACTIVE'), not for coordinate-defined areas.

2.  **Schedule Parsing (Fields D & E)**: This requires precision.
    -   You MUST analyze the schedule portion of the NOTAM (usually in field D or E) and choose the **single most appropriate** schedule field to populate (e.g., \`parsedSchedule\`, \`recurringSchedule\`, \`dailyScheduleWithRanges\`).
    -   **All other schedule fields MUST be \`null\`**. If you populate \`recurringSchedule\`, then \`parsedSchedule\`, \`detailedSchedule\`, etc., must be null.
    -   **Complex Date List Schedules**: For schedules spread across multiple lines listing months, then a series of days, then a time range (e.g., \`AUG 01 03 05 07 0500-0910\`), you MUST expand this into individual entries in the \`parsedSchedule\` array. Each day (01, 03, 05, 07) should become a separate entry for 'AUG' with the specified time. The \`parsedSchedule\` is the correct target for these expanded lists.
    -   **Schedules with Explicit Month and Date Range**: For schedules like \`JUL 29-30 0530-2100\`, you MUST use the \`dailyScheduleWithRanges\` structure. Populate the \`month\` field in the entry with 'JUL', \`startDay\` with 29, \`endDay\` with 30, and the \`timeRanges\` accordingly.
    -   If no schedule is present in the NOTAM, all six schedule fields must be \`null\`.

3.  **Area/Altitude Parsing (\`areaDefinitions\`)**:
    -   Extract coordinate polygons/circles from field E) into the \`areaDefinitions\` array.
    -   Parse vertical limits from fields F) and G) into FEET. Convert Flight Levels (FL) by multiplying by 100 (e.g., FL250 is 25000). 'SFC' or 'GND' is 0 feet.

4.  **Strict Adherence**: The output MUST be a single, valid JSON object conforming to the schema. Do not add fields.

Analyze the following NOTAM:`;

export const parseNotamWithAI = async (notamText: string): Promise<ParsedNotam> => {
    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: notamText,
            config: {
                systemInstruction,
                responseMimeType: "application/json",
                responseSchema: responseSchema,
            },
        });
        
        const rawText = response.text;
        // The API may wrap the JSON in markdown ```json ... ```, so we extract it.
        const match = rawText.match(/```(?:json)?\s*(\{[\s\S]+\})\s*```/);
        const jsonText = match ? match[1] : rawText.trim();
        
        if (!jsonText) {
             throw new Error("AI returned an empty or invalid response.");
        }

        const parsedJson = JSON.parse(jsonText);

        return {
            notamId: parsedJson.notamId ?? null,
            aerodromes: parsedJson.aerodromes ?? null,
            startTime: parsedJson.startTime ?? null,
            endTime: parsedJson.endTime ?? null,
            parsedSchedule: parsedJson.parsedSchedule ?? null,
            recurringSchedule: parsedJson.recurringSchedule ?? null,
            multiTimeRangeSchedule: parsedJson.multiTimeRangeSchedule ?? null,
            complexSchedule: parsedJson.complexSchedule ?? null,
            detailedSchedule: parsedJson.detailedSchedule ?? null,
            dailyScheduleWithRanges: parsedJson.dailyScheduleWithRanges ?? null,
            notamType: parsedJson.notamType ?? NotamType.UNKNOWN,
            affectedElement: parsedJson.affectedElement ?? null,
            reason: parsedJson.reason ?? null,
            airspaceType: parsedJson.airspaceType ?? null,
            airspaceId: parsedJson.airspaceId ?? null,
            areaDefinitions: parsedJson.areaDefinitions ?? null,
        };

    } catch (error) {
        console.error("Error calling Gemini API:", error);
        if (error instanceof Error && error.message.includes('API_KEY')) {
            throw new Error("Invalid or missing API Key. Please check your configuration.");
        }
        if (error instanceof Error && error.message.toLowerCase().includes('json')) {
            throw new Error(`AI returned malformed data. Raw response: ${error.message}`);
        }
        throw new Error("Failed to communicate with the AI service. Please check your connection and API key.");
    }
};
