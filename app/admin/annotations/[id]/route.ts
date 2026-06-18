import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import type { AwakenerAnnotation } from '@/lib/types'

const ANNOTATIONS_PATH = path.join(process.cwd(), 'annotations', 'awakeners.json')

function readAnnotations(): Record<string, AwakenerAnnotation> {
  try {
    return JSON.parse(fs.readFileSync(ANNOTATIONS_PATH, 'utf-8'))
  } catch {
    return {}
  }
}

function writeAnnotations(data: Record<string, AwakenerAnnotation>) {
  fs.writeFileSync(ANNOTATIONS_PATH, JSON.stringify(data, null, 2))
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const annotations = readAnnotations()
  const annotation = annotations[params.id] ?? null
  return NextResponse.json({ annotation })
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await req.json() as AwakenerAnnotation
    const annotations = readAnnotations()
    annotations[params.id] = { ...body, id: params.id }
    writeAnnotations(annotations)
    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const annotations = readAnnotations()
  delete annotations[params.id]
  writeAnnotations(annotations)
  return NextResponse.json({ success: true })
}