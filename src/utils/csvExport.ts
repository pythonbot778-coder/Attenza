// expo-file-system v19 split: the top-level export is the new Paths/File API,
// which does not expose `documentDirectory` / `cacheDirectory` as strings.
// The string-based API moved to the `/legacy` subpath. That's why the original
// import returned `undefined` and triggered "No writable directory available".
import * as FileSystem from 'expo-file-system/legacy'
import * as Sharing from 'expo-sharing'
import { getSemesterCsvData, SemesterCsvData } from '../api/attendanceApi'

export interface ClassMetaForCsv {
  branch:   string
  year:     number | null
  semester: number | null
  section:  string | null
}

interface SubjectColumn {
  id: string
  name: string
  type: 'CLASS' | 'LAB'
}

interface SubjectStat {
  present: number
  total:   number
}

function csvEscape(value: string | number | null | undefined): string {
  const s = String(value ?? '')
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

function pct(present: number, total: number): string {
  return total === 0 ? '-' : `${Math.round((present / total) * 100)}%`
}

/** Convert raw semester data into a 2D CSV string. */
export function buildSemesterCsv(
  data: SemesterCsvData,
  classMeta: ClassMetaForCsv,
  semesterLabel: string,
): string {
  const subjectColumns: SubjectColumn[] = data.subjects.map((s) => ({
    id:   s.id,
    name: s.name,
    type: s.type,
  }))

  // Index: memberId -> subjectId -> { present, total }
  const stats = new Map<string, Map<string, SubjectStat>>()
  for (const m of data.members) {
    stats.set(m.id, new Map())
    for (const s of subjectColumns) {
      stats.get(m.id)!.set(s.id, { present: 0, total: 0 })
    }
  }

  for (const session of data.sessions) {
    for (const rec of session.records) {
      const memberStats = stats.get(rec.class_member_id)
      if (!memberStats) continue
      const subjStat = memberStats.get(session.subject_id)
      if (!subjStat) continue
      subjStat.total += 1
      if (rec.status === 'present') subjStat.present += 1
    }
  }

  // Header rows: class metadata + semester
  const meta: string[] = []
  meta.push(`# Attenza Semester Attendance Export`)
  meta.push(`# Branch: ${classMeta.branch}`)
  meta.push(`# Year: ${classMeta.year ?? '-'}  Semester: ${classMeta.semester ?? '-'}  Section: ${classMeta.section ?? '-'}`)
  meta.push(`# Semester tag: ${semesterLabel}`)
  meta.push(`# Generated: ${new Date().toISOString()}`)
  meta.push('')

  // Column headers
  const headers: string[] = ['Roll Number', 'Name']
  for (const s of subjectColumns) {
    headers.push(csvEscape(`${s.name} (${s.type}) — Present`))
    headers.push(csvEscape(`${s.name} (${s.type}) — Total`))
    headers.push(csvEscape(`${s.name} (${s.type}) — %`))
  }
  headers.push('Overall Present', 'Overall Total', 'Overall %')

  const lines: string[] = [...meta, headers.join(',')]

  // Per-member rows
  for (const m of data.members) {
    const row: string[] = [csvEscape(m.roll_number), csvEscape(m.name ?? '')]
    let overallPresent = 0
    let overallTotal   = 0

    for (const s of subjectColumns) {
      const st = stats.get(m.id)?.get(s.id) ?? { present: 0, total: 0 }
      row.push(String(st.present), String(st.total), pct(st.present, st.total))
      overallPresent += st.present
      overallTotal   += st.total
    }

    row.push(String(overallPresent), String(overallTotal), pct(overallPresent, overallTotal))
    lines.push(row.join(','))
  }

  return lines.join('\n')
}

/**
 * Generate and offer the CSV to the user (download or share).
 * Returns the file URI on success.
 */
export async function exportSemesterCsv(
  classId: string,
  semesterLabel: string,
  classMeta: ClassMetaForCsv,
): Promise<string> {
  const data = await getSemesterCsvData(classId, semesterLabel)
  const csv = buildSemesterCsv(data, classMeta, semesterLabel)

  const safe = (s: string | null | undefined) =>
    String(s ?? '').replace(/[^a-zA-Z0-9_-]/g, '')
  const filename = [
    'attenza',
    safe(classMeta.branch),
    safe(classMeta.section),
    semesterLabel,
    new Date().toISOString().slice(0, 10),
  ].filter(Boolean).join('_') + '.csv'

  const dir = FileSystem.documentDirectory ?? FileSystem.cacheDirectory
  if (!dir) throw new Error('No writable filesystem directory available')
  const uri = `${dir}${filename}`

  await FileSystem.writeAsStringAsync(uri, csv, {
    encoding: FileSystem.EncodingType.UTF8,
  })

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, {
      mimeType: 'text/csv',
      dialogTitle: `Attendance — ${semesterLabel}`,
      UTI: 'public.comma-separated-values-text',
    })
  }

  return uri
}
