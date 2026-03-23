'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

interface FormField {
  name: string
  label: string
  type: 'text' | 'textarea' | 'select' | 'radio' | 'checkbox' | 'date' | 'email'
  required?: boolean
  placeholder?: string
  options?: string[]
}

interface FormDefinition {
  id: string
  title: string
  description: string | null
  fields: FormField[]
  is_active: boolean
  thank_you_message?: string
}

export default function FormPage({ params }: { params: Promise<{ id: string }> }) {
  const [formId, setFormId] = useState<string | null>(null)
  const [form, setForm] = useState<FormDefinition | null>(null)
  const [formData, setFormData] = useState<Record<string, any>>({})
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Resolve params
  useEffect(() => {
    params.then((p) => setFormId(p.id))
  }, [params])

  // Fetch form definition
  useEffect(() => {
    if (!formId) return

    async function fetchForm() {
      const { data, error: fetchError } = await supabase
        .from('forms')
        .select('*')
        .eq('id', formId)
        .eq('is_active', true)
        .single()

      if (fetchError || !data) {
        setError('フォームが見つかりませんでした')
        setLoading(false)
        return
      }

      const fields = Array.isArray(data.fields) ? data.fields : []
      setForm({ ...data, fields } as FormDefinition)

      // Initialize form data with defaults
      const initial: Record<string, any> = {}
      for (const field of fields) {
        if (field.type === 'checkbox') {
          initial[field.name] = []
        } else {
          initial[field.name] = ''
        }
      }
      setFormData(initial)
      setLoading(false)
    }

    fetchForm()
  }, [formId])

  function handleChange(name: string, value: any) {
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  function handleCheckboxChange(name: string, option: string, checked: boolean) {
    setFormData((prev) => {
      const current = Array.isArray(prev[name]) ? prev[name] : []
      if (checked) {
        return { ...prev, [name]: [...current, option] }
      } else {
        return { ...prev, [name]: current.filter((v: string) => v !== option) }
      }
    })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form || submitting) return

    setSubmitting(true)
    setError(null)

    try {
      // Get friend_id from URL search params if available
      const searchParams = new URLSearchParams(window.location.search)
      const friendId = searchParams.get('friend_id') || undefined

      const res = await fetch(`/api/forms/${form.id}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data: formData,
          friend_id: friendId,
        }),
      })

      if (!res.ok) {
        const result = await res.json()
        throw new Error(result.error || '送信に失敗しました')
      }

      setSubmitted(true)
    } catch (err: any) {
      setError(err.message || '送信に失敗しました')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.loading}>読み込み中...</div>
      </div>
    )
  }

  if (error && !form) {
    return (
      <div style={styles.container}>
        <div style={styles.errorCard}>{error}</div>
      </div>
    )
  }

  if (submitted) {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <div style={styles.thankYou}>
            <div style={styles.checkMark}>&#10003;</div>
            <h2 style={styles.thankYouTitle}>送信完了</h2>
            <p style={styles.thankYouMessage}>
              {form?.thank_you_message || 'ご回答ありがとうございました。'}
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (!form) return null

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>{form.title}</h1>
        {form.description && (
          <p style={styles.description}>{form.description}</p>
        )}

        <form onSubmit={handleSubmit} style={styles.form}>
          {form.fields.map((field) => (
            <div key={field.name} style={styles.fieldGroup}>
              <label style={styles.label}>
                {field.label}
                {field.required && <span style={styles.required}> *</span>}
              </label>

              {field.type === 'text' && (
                <input
                  type="text"
                  value={formData[field.name] || ''}
                  onChange={(e) => handleChange(field.name, e.target.value)}
                  placeholder={field.placeholder}
                  required={field.required}
                  style={styles.input}
                />
              )}

              {field.type === 'email' && (
                <input
                  type="email"
                  value={formData[field.name] || ''}
                  onChange={(e) => handleChange(field.name, e.target.value)}
                  placeholder={field.placeholder}
                  required={field.required}
                  style={styles.input}
                />
              )}

              {field.type === 'date' && (
                <input
                  type="date"
                  value={formData[field.name] || ''}
                  onChange={(e) => handleChange(field.name, e.target.value)}
                  required={field.required}
                  style={styles.input}
                />
              )}

              {field.type === 'textarea' && (
                <textarea
                  value={formData[field.name] || ''}
                  onChange={(e) => handleChange(field.name, e.target.value)}
                  placeholder={field.placeholder}
                  required={field.required}
                  rows={4}
                  style={{ ...styles.input, resize: 'vertical' as const }}
                />
              )}

              {field.type === 'select' && (
                <select
                  value={formData[field.name] || ''}
                  onChange={(e) => handleChange(field.name, e.target.value)}
                  required={field.required}
                  style={styles.input}
                >
                  <option value="">選択してください</option>
                  {(field.options ?? []).map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              )}

              {field.type === 'radio' && (
                <div style={styles.optionGroup}>
                  {(field.options ?? []).map((option) => (
                    <label key={option} style={styles.optionLabel}>
                      <input
                        type="radio"
                        name={field.name}
                        value={option}
                        checked={formData[field.name] === option}
                        onChange={(e) => handleChange(field.name, e.target.value)}
                        required={field.required}
                        style={styles.radioCheckbox}
                      />
                      {option}
                    </label>
                  ))}
                </div>
              )}

              {field.type === 'checkbox' && (
                <div style={styles.optionGroup}>
                  {(field.options ?? []).map((option) => (
                    <label key={option} style={styles.optionLabel}>
                      <input
                        type="checkbox"
                        value={option}
                        checked={(formData[field.name] || []).includes(option)}
                        onChange={(e) =>
                          handleCheckboxChange(field.name, option, e.target.checked)
                        }
                        style={styles.radioCheckbox}
                      />
                      {option}
                    </label>
                  ))}
                </div>
              )}
            </div>
          ))}

          {error && <div style={styles.errorText}>{error}</div>}

          <button type="submit" disabled={submitting} style={styles.submitButton}>
            {submitting ? '送信中...' : '送信する'}
          </button>
        </form>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: '100vh',
    backgroundColor: '#f5f5f5',
    padding: '16px',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'flex-start',
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: '12px',
    padding: '24px',
    width: '100%',
    maxWidth: '480px',
    marginTop: '16px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
  },
  title: {
    fontSize: '20px',
    fontWeight: '700',
    color: '#333',
    marginBottom: '8px',
    marginTop: 0,
  },
  description: {
    fontSize: '14px',
    color: '#666',
    marginBottom: '24px',
    lineHeight: '1.6',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  fieldGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  label: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#333',
  },
  required: {
    color: '#e53e3e',
  },
  input: {
    padding: '10px 12px',
    borderRadius: '8px',
    border: '1px solid #ddd',
    fontSize: '16px',
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
    WebkitAppearance: 'none',
  },
  optionGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  optionLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '14px',
    color: '#333',
    cursor: 'pointer',
  },
  radioCheckbox: {
    width: '18px',
    height: '18px',
    cursor: 'pointer',
  },
  submitButton: {
    backgroundColor: '#06C755',
    color: '#ffffff',
    border: 'none',
    borderRadius: '8px',
    padding: '14px',
    fontSize: '16px',
    fontWeight: '600',
    cursor: 'pointer',
    marginTop: '8px',
  },
  loading: {
    textAlign: 'center',
    padding: '40px',
    color: '#666',
    fontSize: '14px',
  },
  errorCard: {
    backgroundColor: '#fff',
    borderRadius: '12px',
    padding: '40px 24px',
    width: '100%',
    maxWidth: '480px',
    textAlign: 'center',
    color: '#666',
    fontSize: '14px',
  },
  errorText: {
    color: '#e53e3e',
    fontSize: '14px',
  },
  thankYou: {
    textAlign: 'center',
    padding: '24px 0',
  },
  checkMark: {
    fontSize: '48px',
    color: '#06C755',
    marginBottom: '16px',
  },
  thankYouTitle: {
    fontSize: '20px',
    fontWeight: '700',
    color: '#333',
    marginBottom: '8px',
  },
  thankYouMessage: {
    fontSize: '14px',
    color: '#666',
    lineHeight: '1.6',
  },
}
