export interface DtsssSession {
  result: 'success' | 'fail'
  loggedIn: boolean
  user: {
    id: string
    name: string
    email: string | null
  } | null
  authority: {
    authId: string
    authNm: string
    authSn: number
    useYn: string
  } | null
  canUseStudio: boolean
  csrf: {
    headerName: string
    parameterName: string
    token: string
  } | null
  message?: string
}

export async function getDtsssSession(): Promise<DtsssSession> {
  const response = await fetch('/api/unity/userAuthority', {
    credentials: 'same-origin',
    headers: { Accept: 'application/json' },
  })
  if (!response.ok) {
    throw new Error(`DTSSS session request failed (${response.status})`)
  }
  return (await response.json()) as DtsssSession
}

export function submitDtsssLogout(session: DtsssSession) {
  const form = document.createElement('form')
  form.method = 'post'
  form.action = '/j_spring_security_logout'

  if (session.csrf) {
    const csrf = document.createElement('input')
    csrf.type = 'hidden'
    csrf.name = session.csrf.parameterName
    csrf.value = session.csrf.token
    form.append(csrf)
  }

  document.body.append(form)
  form.submit()
}
