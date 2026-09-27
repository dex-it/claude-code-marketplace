const STATUS = { type: 'string', enum: ['complete', 'blocked', 'partial'] }
const lack = (v, who) => !v ? `${who} не вернул выход` : v.missing || `${who} вернул blocked без нехватки`
const why = (e) => String(e && e.message || e).slice(0, 300)
