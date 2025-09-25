(define-constant ERR-NOT-AUTHORIZED u100)
(define-constant ERR-DRAW-ALREADY-PERFORMED u101)
(define-constant ERR-INVALID-SLOTS u102)
(define-constant ERR-INVALID-SEED u103)
(define-constant ERR-INVALID-TOTAL-APPLICANTS u104)
(define-constant ERR-LOTTERY-NOT-ACTIVE u105)
(define-constant ERR-LOTTERY-ALREADY-ACTIVE u106)
(define-constant ERR-INVALID-COUNTRY-QUOTA u107)
(define-constant ERR-INVALID-TIMESTAMP u108)
(define-constant ERR-AUTHORITY-NOT-VERIFIED u109)
(define-constant ERR-INVALID-MIN-SLOTS u110)
(define-constant ERR-INVALID-MAX-SLOTS u111)
(define-constant ERR-UPDATE-NOT-ALLOWED u112)
(define-constant ERR-INVALID-UPDATE-PARAM u113)
(define-constant ERR-MAX-LOTTERIES-EXCEEDED u114)
(define-constant ERR-INVALID-LOTTERY-TYPE u115)
(define-constant ERR-INVALID-QUOTA-RATE u116)
(define-constant ERR-INVALID-GRACE-PERIOD u117)
(define-constant ERR-INVALID-REGION u118)
(define-constant ERR-INVALID-CURRENCY u119)
(define-constant ERR-INVALID-STATUS u120)
(define-constant ERR-NO-WINNERS u121)
(define-constant ERR-WINNER-ALREADY-ASSIGNED u122)
(define-constant ERR-INVALID-APPLICANT-ID u123)
(define-constant ERR-QUOTA-EXCEEDED u124)
(define-constant ERR-RANDOMNESS-FAILURE u125)

(define-data-var next-lottery-id uint u0)
(define-data-var max-lotteries uint u100)
(define-data-var activation-fee uint u500)
(define-data-var authority-contract (optional principal) none)
(define-data-var admin principal tx-sender)

(define-map lotteries
  uint
  {
    name: (string-utf8 100),
    slots: uint,
    min-slots: uint,
    max-slots: uint,
    quota-rate: uint,
    timestamp: uint,
    creator: principal,
    lottery-type: (string-utf8 50),
    grace-period: uint,
    region: (string-utf8 100),
    currency: (string-utf8 20),
    status: bool,
    draw-performed: bool
  }
)

(define-map lotteries-by-name
  (string-utf8 100)
  uint)

(define-map lottery-winners
  uint
  (list 10000 principal))

(define-map lottery-updates
  uint
  {
    update-name: (string-utf8 100),
    update-slots: uint,
    update-timestamp: uint,
    updater: principal
  }
)

(define-map country-quotas
  { lottery-id: uint, country: (buff 64) }
  uint)

(define-trait oracle-trait
  (
    (get-random-seed () (response uint uint))
  )
)

(define-trait registry-trait
  (
    (get-total-applicants () (response uint uint))
    (get-applicant (principal) (response {id: uint, details: (buff 128), country: (buff 64)} uint))
    (get-applicants-by-country ((buff 64)) (response (list 10000 principal) uint))
  )
)

(define-read-only (get-lottery (id uint))
  (map-get? lotteries id)
)

(define-read-only (get-lottery-winners (id uint))
  (ok (default-to (list) (map-get? lottery-winners id)))
)

(define-read-only (get-lottery-updates (id uint))
  (map-get? lottery-updates id)
)

(define-read-only (is-lottery-registered (name (string-utf8 100)))
  (is-some (map-get? lotteries-by-name name))
)

(define-read-only (get-country-quota (lottery-id uint) (country (buff 64)))
  (default-to u0 (map-get? country-quotas {lottery-id: lottery-id, country: country}))
)

(define-private (validate-name (name (string-utf8 100)))
  (if (and (> (len name) u0) (<= (len name) u100))
      (ok true)
      (err ERR-INVALID-UPDATE-PARAM))
)

(define-private (validate-slots (slots uint))
  (if (> slots u0)
      (ok true)
      (err ERR-INVALID-SLOTS))
)

(define-private (validate-min-slots (min uint))
  (if (> min u0)
      (ok true)
      (err ERR-INVALID-MIN-SLOTS))
)

(define-private (validate-max-slots (max uint))
  (if (> max u0)
      (ok true)
      (err ERR-INVALID-MAX-SLOTS))
)

(define-private (validate-quota-rate (rate uint))
  (if (<= rate u100)
      (ok true)
      (err ERR-INVALID-QUOTA-RATE))
)

(define-private (validate-timestamp (ts uint))
  (if (>= ts block-height)
      (ok true)
      (err ERR-INVALID-TIMESTAMP))
)

(define-private (validate-lottery-type (type (string-utf8 50)))
  (if (or (is-eq type "visa") (is-eq type "immigration") (is-eq type "diversity"))
      (ok true)
      (err ERR-INVALID-LOTTERY-TYPE))
)

(define-private (validate-grace-period (period uint))
  (if (<= period u30)
      (ok true)
      (err ERR-INVALID-GRACE-PERIOD))
)

(define-private (validate-region (reg (string-utf8 100)))
  (if (and (> (len reg) u0) (<= (len reg) u100))
      (ok true)
      (err ERR-INVALID-REGION))
)

(define-private (validate-currency (cur (string-utf8 20)))
  (if (or (is-eq cur "STX") (is-eq cur "USD") (is-eq cur "BTC"))
      (ok true)
      (err ERR-INVALID-CURRENCY))
)

(define-private (validate-principal (p principal))
  (if (not (is-eq p 'SP000000000000000000002Q6VF78))
      (ok true)
      (err ERR-NOT-AUTHORIZED))
)

(define-public (set-authority-contract (contract-principal principal))
  (begin
    (try! (validate-principal contract-principal))
    (asserts! (is-none (var-get authority-contract)) (err ERR-AUTHORITY-NOT-VERIFIED))
    (var-set authority-contract (some contract-principal))
    (ok true)
  )
)

(define-public (set-max-lotteries (new-max uint))
  (begin
    (asserts! (> new-max u0) (err ERR-INVALID-UPDATE-PARAM))
    (asserts! (is-some (var-get authority-contract)) (err ERR-AUTHORITY-NOT-VERIFIED))
    (var-set max-lotteries new-max)
    (ok true)
  )
)

(define-public (set-activation-fee (new-fee uint))
  (begin
    (asserts! (>= new-fee u0) (err ERR-INVALID-UPDATE-PARAM))
    (asserts! (is-some (var-get authority-contract)) (err ERR-AUTHORITY-NOT-VERIFIED))
    (var-set activation-fee new-fee)
    (ok true)
  )
)

(define-public (create-lottery
  (lottery-name (string-utf8 100))
  (slots uint)
  (min-slots uint)
  (max-slots uint)
  (quota-rate uint)
  (lottery-type (string-utf8 50))
  (grace-period uint)
  (region (string-utf8 100))
  (currency (string-utf8 20))
)
  (let (
        (next-id (var-get next-lottery-id))
        (current-max (var-get max-lotteries))
        (authority (var-get authority-contract))
      )
    (asserts! (< next-id current-max) (err ERR-MAX-LOTTERIES-EXCEEDED))
    (try! (validate-name lottery-name))
    (try! (validate-slots slots))
    (try! (validate-min-slots min-slots))
    (try! (validate-max-slots max-slots))
    (try! (validate-quota-rate quota-rate))
    (try! (validate-lottery-type lottery-type))
    (try! (validate-grace-period grace-period))
    (try! (validate-region region))
    (try! (validate-currency currency))
    (asserts! (is-none (map-get? lotteries-by-name lottery-name)) (err ERR-LOTTERY-ALREADY-ACTIVE))
    (let ((authority-recipient (unwrap! authority (err ERR-AUTHORITY-NOT-VERIFIED))))
      (try! (stx-transfer? (var-get activation-fee) tx-sender authority-recipient))
    )
    (map-set lotteries next-id
      {
        name: lottery-name,
        slots: slots,
        min-slots: min-slots,
        max-slots: max-slots,
        quota-rate: quota-rate,
        timestamp: block-height,
        creator: tx-sender,
        lottery-type: lottery-type,
        grace-period: grace-period,
        region: region,
        currency: currency,
        status: true,
        draw-performed: false
      }
    )
    (map-set lotteries-by-name lottery-name next-id)
    (var-set next-lottery-id (+ next-id u1))
    (print { event: "lottery-created", id: next-id })
    (ok next-id)
  )
)

(define-public (perform-draw
  (lottery-id uint)
  (oracle <oracle-trait>)
  (registry <registry-trait>)
)
  (let ((lottery (map-get? lotteries lottery-id)))
    (match lottery
      l
        (begin
          (asserts! (is-eq tx-sender (var-get admin)) (err ERR-NOT-AUTHORIZED))
          (asserts! (not (get draw-performed l)) (err ERR-DRAW-ALREADY-PERFORMED))
          (asserts! (get status l) (err ERR-LOTTERY-NOT-ACTIVE))
          (match (contract-call? oracle get-random-seed)
            seed
              (match (contract-call? registry get-total-applicants)
                total
                  (let (
                        (slots (get slots l))
                        (selected (select-winners-with-quotas lottery-id seed total slots registry))
                      )
                    (asserts! (> (len selected) u0) (err ERR-NO-WINNERS))
                    (map-set lottery-winners lottery-id selected)
                    (map-set lotteries lottery-id (merge l { draw-performed: true }))
                    (print { event: "draw-performed", id: lottery-id, winners-count: (len selected) })
                    (ok true)
                  )
                error (err error)
              )
            error (err error)
          )
        )
      (err ERR-LOTTERY-NOT-ACTIVE)
    )
  )
)

(define-private (select-winners-with-quotas
  (lottery-id uint)
  (seed uint)
  (total uint)
  (slots uint)
  (registry <registry-trait>)
)
  (let (
        (countries (list
          (buff 64 "US")
          (buff 64 "IN")
          (buff 64 "CN")
          (buff 64 "BR")
          (buff 64 "NG")
        ))
        (quota-per-country (/ slots u5))
      )
    (fold (lambda (country acc) (assign-quotas lottery-id country acc registry)) countries (list))
  )
)

(define-private (assign-quotas
  (lottery-id uint)
  (country (buff 64))
  (acc (list 10000 principal))
  (registry <registry-trait>)
)
  (let (
        (applicants (unwrap! (contract-call? registry get-applicants-by-country country) (list)))
        (quota (get-country-quota lottery-id country))
      )
    (if (> quota u0)
        (append acc (take quota applicants))
        acc
    )
  )
)

(define-private (take (n uint) (lst (list 10000 principal)))
  (if (is-eq n u0)
      (list)
      (match lst
        head (cons head (take (- n u1) (unwrap-panic (as-max-len? lst u9999))))
        (list)
      )
  )
)

(define-public (update-lottery
  (lottery-id uint)
  (update-name (string-utf8 100))
  (update-slots uint)
)
  (let ((lottery (map-get? lotteries lottery-id)))
    (match lottery
      l
        (begin
          (asserts! (is-eq (get creator l) tx-sender) (err ERR-NOT-AUTHORIZED))
          (asserts! (not (get draw-performed l)) (err ERR-UPDATE-NOT-ALLOWED))
          (try! (validate-name update-name))
          (try! (validate-slots update-slots))
          (let ((existing (map-get? lotteries-by-name update-name)))
            (match existing
              existing-id
                (asserts! (is-eq existing-id lottery-id) (err ERR-LOTTERY-ALREADY-ACTIVE))
              (ok true)
            )
          )
          (let ((old-name (get name l)))
            (if (is-eq old-name update-name)
                (ok true)
                (begin
                  (map-delete lotteries-by-name old-name)
                  (map-set lotteries-by-name update-name lottery-id)
                  (ok true)
                )
            )
          )
          (map-set lotteries lottery-id
            (merge l {
              name: update-name,
              slots: update-slots,
              timestamp: block-height
            })
          )
          (map-set lottery-updates lottery-id
            {
              update-name: update-name,
              update-slots: update-slots,
              update-timestamp: block-height,
              updater: tx-sender
            }
          )
          (print { event: "lottery-updated", id: lottery-id })
          (ok true)
        )
      (err ERR-LOTTERY-NOT-ACTIVE)
    )
  )
)

(define-public (set-country-quota
  (lottery-id uint)
  (country (buff 64))
  (quota uint)
)
  (let ((lottery (map-get? lotteries lottery-id)))
    (match lottery
      l
        (begin
          (asserts! (is-eq tx-sender (get creator l)) (err ERR-NOT-AUTHORIZED))
          (try! (validate-slots quota))
          (map-set country-quotas {lottery-id: lottery-id, country: country} quota)
          (ok true)
        )
      (err ERR-LOTTERY-NOT-ACTIVE)
    )
  )
)

(define-public (get-lottery-count)
  (ok (var-get next-lottery-id))
)

(define-public (check-lottery-existence (name (string-utf8 100)))
  (ok (is-lottery-registered name))
)

(define-public (reset-lottery (lottery-id uint))
  (let ((lottery (map-get? lotteries lottery-id)))
    (match lottery
      l
        (begin
          (asserts! (is-eq tx-sender (var-get admin)) (err ERR-NOT-AUTHORIZED))
          (asserts! (get draw-performed l) (err ERR-UPDATE-NOT-ALLOWED))
          (map-set lotteries lottery-id (merge l { draw-performed: false }))
          (map-delete lottery-winners lottery-id)
          (ok true)
        )
      (err ERR-LOTTERY-NOT-ACTIVE)
    )
  )
)

(define-public (deactivate-lottery (lottery-id uint))
  (let ((lottery (map-get? lotteries lottery-id)))
    (match lottery
      l
        (begin
          (asserts! (is-eq tx-sender (get creator l)) (err ERR-NOT-AUTHORIZED))
          (map-set lotteries lottery-id (merge l { status: false }))
          (ok true)
        )
      (err ERR-LOTTERY-NOT-ACTIVE)
    )
  )
)