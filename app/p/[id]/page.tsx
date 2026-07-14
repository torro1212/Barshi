import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { AppShell } from '@/components/nav/AppShell'
import { ProjectPageClient } from './ProjectPageClient'
import { getProjectById, getRelatedProjects } from '@/lib/db/queries/projects'

interface Props { params: Promise<{ id: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const project = await getProjectById(id)
  if (!project) return { title: 'Project not found' }
  return {
    title: `${project.title} — Barshi`,
    description: project.description ?? `A ${project.type} built on Barshi`,
  }
}

export default async function ProjectPage({ params }: Props) {
  const { id } = await params
  const project = await getProjectById(id)

  if (!project || project.visibility !== 'public') notFound()

  const related = await getRelatedProjects(id, project.type, 4)

  return (
    <AppShell>
      <ProjectPageClient project={project} related={related} />
    </AppShell>
  )
}
