import { NextResponse } from 'next/server'
import { getStripe, isStripeConfigured } from '@/lib/stripe/server'
import { createClient } from '@/lib/supabase/server'
import { PLANS } from '@/constants/pricing'
import type { PlanKey } from '@/constants/pricing'
import { requireEnv } from '@/lib/utils/env'

function getPriceId(planId: PlanKey): string {
  const envKey = PLANS[planId].stripePriceEnv
  return requireEnv(envKey)
}

/** Reservation deposit as a fraction of the trip's total budget. */
const RESERVATION_DEPOSIT_RATE = 0.15
/** Floor so tiny trips still meet Stripe's minimum charge. */
const RESERVATION_MIN_AMOUNT = 5

interface ReservationBody {
  mode: 'reservation'
  tripId: string
  destino: string
  presupuestoTotal: number
  moneda?: string
}

interface SubscriptionBody {
  planId: unknown
}

function isReservationBody(body: unknown): body is ReservationBody {
  return (
    typeof body === 'object' &&
    body !== null &&
    (body as { mode?: unknown }).mode === 'reservation'
  )
}

export async function POST(req: Request) {
  // Degrade gracefully when Stripe is not configured: never throw / 500.
  if (!isStripeConfigured()) {
    return NextResponse.json({ configured: false }, { status: 200 })
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = (await req.json()) as unknown
  const stripe = getStripe()
  const baseUrl = requireEnv('NEXT_PUBLIC_BASE_URL')

  // --- Trip reservation (one-time payment for a trip deposit) ---
  if (isReservationBody(body)) {
    const total = Number(body.presupuestoTotal)
    if (
      !body.tripId ||
      !body.destino ||
      !Number.isFinite(total) ||
      total <= 0
    ) {
      return NextResponse.json(
        { error: 'Invalid reservation' },
        { status: 400 }
      )
    }

    const currency = (body.moneda ?? 'USD').toLowerCase()
    const deposit = Math.max(
      RESERVATION_MIN_AMOUNT,
      Math.round(total * RESERVATION_DEPOSIT_RATE)
    )

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      ...(user.email !== undefined ? { customer_email: user.email } : {}),
      client_reference_id: user.id,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency,
            unit_amount: deposit * 100,
            product_data: {
              name: `Reserva de viaje a ${body.destino}`,
              description: `Depósito de reserva (${Math.round(
                RESERVATION_DEPOSIT_RATE * 100
              )}% del presupuesto)`,
            },
          },
        },
      ],
      success_url: `${baseUrl}/dashboard?reserva=success&dest=${encodeURIComponent(
        body.destino
      )}`,
      cancel_url: `${baseUrl}/?reserva=cancelled`,
      metadata: {
        userId: user.id,
        type: 'reservation',
        tripId: body.tripId,
        destino: body.destino,
      },
    })

    return NextResponse.json({ url: session.url })
  }

  // --- Subscription / plan checkout (existing behavior) ---
  const planId = (body as SubscriptionBody).planId as PlanKey
  if (!(planId in PLANS)) {
    return NextResponse.json({ error: 'Invalid plan' }, { status: 400 })
  }

  const plan = PLANS[planId]
  const mode = plan.periodo === 'único' ? 'payment' : 'subscription'

  const session = await stripe.checkout.sessions.create({
    mode,
    ...(user.email !== undefined ? { customer_email: user.email } : {}),
    client_reference_id: user.id,
    line_items: [{ price: getPriceId(planId), quantity: 1 }],
    success_url: `${baseUrl}/dashboard?upgrade=success`,
    cancel_url: `${baseUrl}/precios?upgrade=cancelled`,
    metadata: { userId: user.id, planId },
  })

  return NextResponse.json({ url: session.url })
}
