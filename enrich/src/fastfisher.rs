pub struct FastFisher{f: Vec<f64>}

impl FastFisher {
  pub fn new() -> Self {
    FastFisher{f: vec![0.0]}
  }

  pub fn get_f(&self) -> &Vec<f64> {
    &self.f
  }

  pub fn extend_to(self: &mut Self, max_size: usize) {
    while self.f.len() <= max_size {
      let i = self.f.len();
      self.f.push(self.f[i-1] + (i as f64).ln());
    }
  }

  fn get_p(self: &Self, a: usize, b: usize, c: usize, d: usize, same: f64) -> f64 {
    (same - (self.f[a] + self.f[b] + self.f[c] + self.f[d])).exp()
  }

  fn log_choose(self: &Self, n: usize, k: usize) -> Option<f64> {
    if k > n || n >= self.f.len() {
      return None;
    }
    Some(self.f[n] - self.f[k] - self.f[n - k])
  }

  fn hypergeom_pmf(self: &Self, population: usize, successes: usize, draws: usize, observed: usize) -> f64 {
    if successes > population || draws > population {
      return f64::NAN;
    }

    let min_observed = draws.saturating_sub(population - successes);
    let max_observed = usize::min(successes, draws);
    if observed < min_observed || observed > max_observed {
      return 0.0;
    }

    let log_p = match (
      self.log_choose(successes, observed),
      self.log_choose(population - successes, draws - observed),
      self.log_choose(population, draws),
    ) {
      (Some(left), Some(right), Some(total)) => left + right - total,
      _ => return f64::NAN,
    };
    log_p.exp()
  }

  fn hypergeom_pmf_vec(self: &Self, population: usize, successes: usize, draws: usize) -> Vec<f64> {
    if successes > population || draws > population || population >= self.f.len() {
      return vec![f64::NAN];
    }

    let max_observed = usize::min(successes, draws);
    let mut pmf = vec![0.0; max_observed + 1];
    for observed in 0..=max_observed {
      pmf[observed] = self.hypergeom_pmf(population, successes, draws, observed);
    }
    pmf
  }

  pub fn get_convolved_p_value(
    self: &Self,
    observed_left: usize,
    observed_right: usize,
    draws_left: usize,
    draws_right: usize,
    successes_left: usize,
    successes_right: usize,
    population: usize,
  ) -> f64 {
    let observed_total = observed_left + observed_right;
    if observed_total == 0 {
      return 1.0;
    }

    let pmf_left = self.hypergeom_pmf_vec(population, successes_left, draws_left);
    let pmf_right = self.hypergeom_pmf_vec(population, successes_right, draws_right);
    if pmf_left.iter().any(|p| p.is_nan()) || pmf_right.iter().any(|p| p.is_nan()) {
      return f64::NAN;
    }

    let mut right_tail = vec![0.0; pmf_right.len() + 1];
    for observed in (0..pmf_right.len()).rev() {
      right_tail[observed] = right_tail[observed + 1] + pmf_right[observed];
    }

    let mut pvalue = 0.0;
    for (left_observed, left_p) in pmf_left.iter().enumerate() {
      let min_right_observed = observed_total.saturating_sub(left_observed);
      if min_right_observed < right_tail.len() {
        pvalue += left_p * right_tail[min_right_observed];
      }
    }
    pvalue.min(1.0)
  }

  pub fn get_p_value(self: &Self, mut a: usize, mut b: usize, mut c: usize, mut d: usize) -> f64 {
    let n = a + b + c + d;
    
    if n > self.f.len() {
      return f64::NAN;
    }
    let same = self.f[a + b] + self.f[c + d] + self.f[a + c] + self.f[b + d] - self.f[n];
    let mut p = self.get_p(a, b, c, d, same);
    
    let minimum = usize::min(c, b);
    for _ in 0..minimum {
        a += 1;
        b -= 1;
        c -= 1;
        d += 1;
        p += self.get_p(a, b, c, d, same);
    }
    p
  }
}