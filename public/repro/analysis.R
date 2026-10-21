# Acaora processed-table reproduction runtime. See README.txt.
suppressPackageStartupMessages({library(jsonlite); library(digest)})
js_sort <- function(x) {
  x <- unique(x)
  key <- vapply(x, function(s) paste(sprintf('%02x',as.integer(iconv(s,to='UTF-16BE',toRaw=TRUE)[[1]])),collapse=''), '')
  x[order(key,method='radix')]
}
lcg <- function(seed) { state <- as.double(seed); function() { state <<- (state*1664525+1013904223) %% 4294967296; state/4294967296 } }
assignments <- function(n,k,random) {
  order <- seq_len(n)
  if(n>1) for(i in n:2) { j <- floor(random()*i)+1; tmp <- order[i]; order[i] <- order[j]; order[j] <- tmp }
  out <- integer(n); offset <- 0
  for(f in seq_len(k)) { size <- n%/%k+as.integer(f<=n%%k); if(size>0) out[order[offset+seq_len(size)]] <- f-1; offset <- offset+size }
  out
}
`%or%` <- function(x,y) if(is.null(x)) y else x
num <- function(v) suppressWarnings(as.numeric(v))
missing_value <- function(v) tolower(trimws(v)) %in% c('','na','null','nan')
required <- function(a) {
  c <- a$config; m <- c$method; predictors <- unlist(c$predictors); cats <- vapply(c$categoricals %or% list(),function(s)s$name,'')
  if(a$kind=='basic') return(if(m=='describe')c$x else if(m=='relation')c(c$x,c$y) else c(c$group,c$value))
  if(a$kind=='ols') return(c(c$outcome,predictors,cats))
  if(m %in% c('pca','kmeans')) return(predictors)
  if(m %in% c('paired','wilcoxon')) return(c(c$outcome,c$second))
  if(m %in% c('anova','welchanova','posthoc','mannwhitney')) return(c(c$outcome,c$group))
  if(m=='bootstrap') return(c(c$outcome,if(c$bootstrapStatistic %or% 'mean' %in% c('paired-difference','correlation'))c$second,if(identical(c$bootstrapStatistic,'difference'))c$group,if(identical(c$bootstrapUnit,'cluster'))c$bootstrapCluster))
  c(c$outcome,predictors,cats,if(m %in% c('cluster','fixed')||identical(c$validation,'group'))c$group,if(m %in% c('cv','classification')&&identical(c$validation,'time'))c$time)
}
design <- function(rows,c,train=rows) {
  predictors <- unlist(c$predictors); x <- matrix(numeric(),nrow=nrow(rows),ncol=0); labels <- predictors
  for(h in predictors) x <- cbind(x,num(rows[,h]))
  for(spec in c$categoricals %or% list()) {
    levels <- js_sort(trimws(train[,spec$name])); ref <- spec$reference
    if(!(ref %in% levels)||length(levels)<2||length(levels)>12)stop('Invalid training categories/reference')
    if(any(!trimws(rows[,spec$name]) %in% levels))stop('Unseen validation category')
    for(level in levels[levels!=ref]) { x <- cbind(x,as.numeric(trimws(rows[,spec$name])==level)); labels <- c(labels,paste0(spec$name,' [',level,' vs ',ref,']')) }
  }
  if(ncol(x)<1||ncol(x)>12)stop('Expanded predictors outside 1..12')
  list(x=x,labels=labels)
}
safe_logistic <- function(x,y) {
  if(!setequal(unique(y),c(0,1)))stop('Both training classes required')
  if(nrow(x)<=ncol(x)||qr(x)$rank!=ncol(x))stop('Insufficient/rank-deficient training design')
  fit <- glm.fit(x,y,family=binomial(),control=glm.control(epsilon=1e-10,maxit=100))
  if(!fit$converged||min(fit$fitted.values*(1-fit$fitted.values))<1e-12)stop('Separation or nonconvergence')
  fit
}
binary_metrics <- function(y,p,threshold) {
  if(!setequal(unique(y),c(0,1)))stop('Both validation classes required')
  positive <- sum(y); negative <- length(y)-positive; order <- order(-p); tp <- fp <- auc <- ap <- lastFpr <- lastRec <- 0
  roc <- list(c(NA,0,0)); pr <- list(c(NA,0,1)); i <- 1
  while(i<=length(order)) {
    j <- i
    while(j<=length(order)&&p[order[j]]==p[order[i]]) {tp <- tp+y[order[j]]; fp <- fp+1-y[order[j]]; j <- j+1}
    rec <- tp/positive; fpr <- fp/negative; precision <- tp/(tp+fp)
    auc <- auc+(fpr-lastFpr)*(rec+lastRec)/2; ap <- ap+(rec-lastRec)*precision
    roc[[length(roc)+1]] <- c(p[order[i]],fpr,rec); pr[[length(pr)+1]] <- c(p[order[i]],rec,precision); lastFpr <- fpr; lastRec <- rec; i <- j
  }
  pred <- p>=threshold; tp <- sum(pred&y==1); fp <- sum(pred&y==0); tn <- sum(!pred&y==0); fn <- sum(!pred&y==1); clipped <- pmin(1-1e-15,pmax(1e-15,p))
  bins <- lapply(0:9,function(b){selected <- pmin(9,floor(p*10))==b;c(b/10,(b+1)/10,sum(selected),if(any(selected))mean(p[selected]) else NA,if(any(selected))mean(y[selected]) else NA)})
  list(auc=auc,ap=ap,brier=mean((p-y)^2),logloss=-mean(y*log(clipped)+(1-y)*log1p(-clipped)),tp=tp,fp=fp,tn=tn,fn=fn,precision=if(tp+fp>0)tp/(tp+fp) else NA,recall=tp/(tp+fn),specificity=tn/(tn+fp),f1=if(2*tp+fp+fn>0)2*tp/(2*tp+fp+fn) else NA,roc=roc,pr=pr,calibration=bins)
}
run_analysis <- function(a,data) {
  c <- a$config; m <- if(a$kind=='ols')'ols' else c$method; cols <- required(a)
  if(anyDuplicated(cols)||any(!cols %in% unlist(data$headers)))stop('Invalid required columns')
  raw <- do.call(rbind,lapply(data$rows,unlist)); colnames(raw) <- unlist(data$headers)
  text <- vapply(c$categoricals %or% list(),function(s)s$name,'')
  if(m %in% c('cluster','fixed','anova','welchanova','posthoc','mannwhitney','test')||(m %in% c('cv','classification')&&identical(c$validation,'group'))||(m=='bootstrap'&&identical(c$bootstrapStatistic,'difference')))text <- c(text,c$group)
  if(m=='bootstrap'&&identical(c$bootstrapUnit,'cluster'))text <- c(text,c$bootstrapCluster)
  valid <- rep(TRUE,nrow(raw))
  for(h in cols) valid <- valid&!missing_value(raw[,h])&if(h %in% text)TRUE else is.finite(num(raw[,h]))
  rows <- raw[valid,,drop=FALSE]; n <- nrow(rows); if(n < if(m=='describe')1 else 3)stop('Insufficient complete observations')
  out <- list(method=m,n=n,excluded=nrow(raw)-n,current_table_rows=which(valid)); column <- function(h)num(rows[,h])
  if(m=='describe') {x <- column(c$x);return(c(out,list(mean=mean(x),sd=sd(x),min=min(x),median=median(x),max=max(x),q1=unname(quantile(x,.25)),q3=unname(quantile(x,.75)))))}
  if(m=='relation') {x <- column(c$x);y <- column(c$y);fit <- lm(y~x);s <- summary(fit);return(c(out,list(r=cor(x,y),coefficients=unname(coef(fit)),p=s$coefficients[2,4],r2=s$r.squared)))}
  if(m %in% c('paired','wilcoxon')) {
    d <- column(c$outcome)-column(c$second);out$differences <- d
    if(m=='paired') {fit <- t.test(d);out <- c(out,list(estimate=mean(d),se=sd(d)/sqrt(n),t=unname(fit$statistic),p=fit$p.value,df=n-1,low=fit$conf.int[1],high=fit$conf.int[2]))}
    else {d <- d[d!=0];fit <- wilcox.test(d,exact=FALSE,correct=TRUE);w <- min(unname(fit$statistic),length(d)*(length(d)+1)/2-unname(fit$statistic));out <- c(out,list(w=w,p=fit$p.value))}
    return(out)
  }
  if(m %in% c('test','anova','welchanova','posthoc','mannwhitney')) {
    h <- if(m=='test')c$value else c$outcome; groups <- js_sort(trimws(rows[,c$group]));samples <- lapply(groups,function(g)num(rows[trimws(rows[,c$group])==g,h]))
    out$groups <- lapply(seq_along(groups),function(i)list(name=groups[i],n=length(samples[[i]]),mean=mean(samples[[i]]),sd=sd(samples[[i]])))
    if(m %in% c('test','mannwhitney')&&length(groups)!=2)stop('Exactly two groups required')
    if(m=='test') {fit <- t.test(samples[[1]],samples[[2]],var.equal=FALSE);out <- c(out,list(t=unname(fit$statistic),p=fit$p.value,df=unname(fit$parameter)))}
    else if(m=='mannwhitney') {fit <- wilcox.test(samples[[1]],samples[[2]],exact=FALSE,correct=TRUE);out <- c(out,list(u=unname(fit$statistic),p=fit$p.value))}
    else if(m %in% c('anova','welchanova')) {v <- unlist(samples);g <- factor(rep(seq_along(samples),lengths(samples)));fit <- oneway.test(v~g,var.equal=m=='anova');out <- c(out,list(f=unname(fit$statistic),p=fit$p.value,df=unname(fit$parameter)))}
    else {
      pairs <- list()
      for(i in seq_len(length(groups)-1))for(j in (i+1):length(groups)) {
        if(identical(c$posthocFamily,'reference')&&!c$posthocReference %in% groups[c(i,j)])next
        left <- i;right <- j
        if(identical(c$posthocFamily,'reference')&&groups[i]==c$posthocReference){left <- j;right <- i}
        x <- samples[[left]];y <- samples[[right]];fit <- t.test(x,y,var.equal=FALSE)
        pairs[[length(pairs)+1]] <- list(left=groups[left],right=groups[right],estimate=mean(x)-mean(y),se=sqrt(var(x)/length(x)+var(y)/length(y)),t=unname(fit$statistic),df=unname(fit$parameter),p=fit$p.value,low=fit$conf.int[1],high=fit$conf.int[2])
      }
      adjusted <- p.adjust(vapply(pairs,function(p)p$p,0.),'holm');for(i in seq_along(pairs))pairs[[i]]$holm_p <- adjusted[i];out$contrasts <- pairs
    }
    return(out)
  }
  if(m=='bootstrap') {
    stat <- c$bootstrapStatistic %or% 'mean';unit <- c$bootstrapUnit %or% 'row';B <- c$bootstrapIterations %or% 500;random <- lcg(c$seed);groups <- if(stat=='difference')js_sort(trimws(rows[,c$group])) else character()
    if(B<100||B>2000||B*n>20000000)stop('Bootstrap budget exceeded')
    if(stat=='difference'&&length(groups)!=2)stop('Exactly two groups required')
    estimate <- function(sample) {
      x <- num(sample[,c$outcome])
      if(stat=='mean')return(mean(x))
      if(stat=='paired-difference')return(mean(x-num(sample[,c$second])))
      if(stat=='correlation')return(suppressWarnings(cor(x,num(sample[,c$second]))))
      a <- x[trimws(sample[,c$group])==groups[1]];b <- x[trimws(sample[,c$group])==groups[2]]
      if(!length(a)||!length(b))return(NA_real_)
      mean(a)-mean(b)
    }
    if(unit=='cluster') {keys <- unique(trimws(rows[,c$bootstrapCluster]));units <- lapply(keys,function(k)which(trimws(rows[,c$bootstrapCluster])==k));if(length(units)<2)stop('Two subjects required')}
    else units <- if(stat=='difference')lapply(groups,function(g)which(trimws(rows[,c$group])==g)) else list(seq_len(n))
    replicates <- matrix(NA_real_,B,2);visits <- 0
    for(b in seq_len(B)) {
      if(unit=='cluster')indices <- unlist(lapply(seq_along(units),function(j)units[[floor(random()*length(units))+1]]))
      else indices <- unlist(lapply(units,function(g)vapply(seq_along(g),function(j)g[floor(random()*length(g))+1],0)))
      visits <- visits+length(indices);if(unit=='cluster'&&visits>25000000)stop('Actual resampling budget exceeded')
      replicates[b,] <- c(estimate(rows[indices,,drop=FALSE]),length(indices))
    }
    v <- replicates[is.finite(replicates[,1]),1];if(length(v)<B*.95)stop('Fewer than 95% valid replicates')
    return(c(out,list(estimate=estimate(rows),se=sd(v),low=unname(quantile(v,.025)),high=unname(quantile(v,.975)),valid=length(v),failed=B-length(v),replicates=replicates)))
  }
  d <- design(rows,c);x <- d$x;labels <- d$labels
  if(m %in% c('pca','kmeans')) {
    mu <- colMeans(x);sigma <- apply(x,2,sd);z <- scale(x,center=mu,scale=sigma);out <- c(out,list(means=mu,scales=sigma))
    if(m=='pca') {
      fit <- svd(z);v <- fit$v
      for(j in seq_len(ncol(v)))if(v[which.max(abs(v[,j])),j]<0)v[,j] <- -v[,j]
      eigen <- fit$d^2/(n-1);out <- c(out,list(eigenvalues=eigen,explained=eigen/sum(eigen),weights=v[,seq_len(c$components),drop=FALSE],scores=z%*%v[,seq_len(c$components),drop=FALSE]))
    } else {
      k <- c$clusters;random <- lcg(c$seed);best <- NULL
      dist2 <- function(centers) sapply(seq_len(nrow(centers)),function(j)rowSums(sweep(z,2,centers[j,],'-')^2))
      for(attempt in 1:5) {
        centers <- z[floor(random()*n)+1,,drop=FALSE]
        while(nrow(centers)<k){dist <- apply(dist2(centers),1,min);if(max(dist)<=1e-20)stop('Too few distinct patterns');centers <- rbind(centers,z[which.max(dist),])}
        old <- rep(-1,n)
        for(it in 1:200) {
          pred <- max.col(-dist2(centers),ties.method='first');if(any(tabulate(pred,nbins=k)==0))break
          centers <- do.call(rbind,lapply(seq_len(k),function(j)colMeans(z[pred==j,,drop=FALSE])))
          if(all(pred==old)){inertia <- sum((z-centers[pred,,drop=FALSE])^2);if(is.null(best)||inertia<best$inertia)best <- list(inertia=inertia,centers=sweep(sweep(centers,2,sigma,'*'),2,mu,'+'),labels=pred,iterations=it);break};old <- pred
        }
      }
      if(is.null(best))stop('K-means did not converge');out <- c(out,best)
    }
    return(out)
  }
  y <- column(c$outcome)
  if(m %in% c('cv','classification')) {
    k <- c$folds;mode <- c$validation %or% 'random';random <- lcg(c$seed)
    if(mode=='group') {groups <- js_sort(trimws(rows[,c$group]));mapping <- assignments(length(groups),k,random);folds <- mapping[match(trimws(rows[,c$group]),groups)]}
    else if(mode=='time') {
      times <- sort(unique(column(c$time)));if(length(times)<k+1)stop('Insufficient distinct times');mapping <- integer(length(times));offset <- 0
      for(chunk in 0:k){size <- length(times)%/%(k+1)+as.integer(chunk<length(times)%%(k+1));mapping[offset+seq_len(size)] <- chunk-1;offset <- offset+size};folds <- mapping[match(column(c$time),times)]
    } else folds <- assignments(n,k,random)
    predictions <- baseline <- rep(NA_real_,n);details <- list()
    for(f in 0:(k-1)) {
      train <- if(mode=='time')folds<f else folds!=f;held <- folds==f;training <- rows[train,,drop=FALSE]
      dt <- design(training,c,training);xt <- dt$x;xh <- design(rows[held,,drop=FALSE],c,training)$x
      if(m=='classification'){fit <- safe_logistic(cbind(1,xt),y[train]);predictions[held] <- plogis(cbind(1,xh)%*%fit$coefficients)}
      else {mu <- colMeans(xt);sigma <- apply(xt,2,sd);fit <- lm.fit(cbind(1,scale(xt,center=mu,scale=sigma)),y[train]);predictions[held] <- cbind(1,scale(xh,center=mu,scale=sigma))%*%fit$coefficients;baseline[held] <- mean(y[train])}
      details[[f+1]] <- list(fold=f+1,train=sum(train),held=sum(held),labels=dt$labels)
    }
    valid <- is.finite(predictions);out <- c(out,list(folds=folds+1,predictions=predictions,folds_detail=details))
    if(m=='classification')out <- c(out,binary_metrics(y[valid],predictions[valid],c$threshold %or% .5))
    else {e <- y[valid]-predictions[valid];denom <- sum((y[valid]-mean(y[valid]))^2);out <- c(out,list(rmse=sqrt(mean(e^2)),mae=mean(abs(e)),r2=if(denom>0)1-sum(e^2)/denom else NA,baseline_rmse=sqrt(mean((y[valid]-baseline[valid])^2))))}
    return(out)
  }
  if(m=='fixed') {
    keys <- trimws(rows[,c$group]);groups <- js_sort(keys);xd <- x;yd <- y
    for(g in groups){sel <- keys==g;xd[sel,] <- sweep(x[sel,,drop=FALSE],2,colMeans(x[sel,,drop=FALSE]),'-');yd[sel] <- y[sel]-mean(y[sel])}
    fit <- lm.fit(xd,yd);b <- fit$coefficients;e <- fit$residuals;bread <- solve(crossprod(xd));meat <- matrix(0,ncol(x),ncol(x))
    for(g in groups){score <- crossprod(xd[keys==g,,drop=FALSE],e[keys==g]);meat <- meat+tcrossprod(score)}
    df <- n-length(groups)-ncol(x);cov <- bread%*%meat%*%bread*length(groups)/(length(groups)-1)*(n-1)/df;se <- sqrt(diag(cov));t <- b/se;crit <- qt(.975,length(groups)-1)
    return(c(out,list(labels=labels,coefficients=b,se=se,t=t,p=2*pt(-abs(t),length(groups)-1),low=b-crit*se,high=b+crit*se,r2=1-sum(e^2)/sum(yd^2))))
  }
  xx <- cbind(1,x)
  if(m=='logistic'){fit <- safe_logistic(xx,y);class(fit) <- c('glm','lm');s <- summary(fit);b <- fit$coefficients;se <- s$coefficients[,2];t <- b/se;p <- 2*pnorm(-abs(t));crit <- qnorm(.975);out <- c(out,list(predictions=fit$fitted.values,odds_ratio=exp(b)))}
  else {
    fit <- lm.fit(xx,y);b <- fit$coefficients;e <- fit$residuals;pcount <- ncol(xx);bread <- solve(crossprod(xx));df <- n-pcount;meat <- matrix(0,pcount,pcount)
    if(m=='cluster') {
      keys <- trimws(rows[,c$group]);groups <- js_sort(keys)
      for(g in groups){score <- crossprod(xx[keys==g,,drop=FALSE],e[keys==g]);meat <- meat+tcrossprod(score)}
      cov <- bread%*%meat%*%bread*length(groups)/(length(groups)-1)*(n-1)/df;referenceDf <- length(groups)-1
    } else if(identical(c$standardErrors,'HC3')) {
      h <- rowSums((xx%*%bread)*xx);score <- xx*as.vector(e/(1-h));cov <- bread%*%crossprod(score)%*%bread;referenceDf <- df
    } else {cov <- bread*sum(e^2)/df;referenceDf <- df}
    se <- sqrt(diag(cov));t <- b/se;p <- 2*pt(-abs(t),referenceDf);crit <- qt(.975,referenceDf);r2 <- 1-sum(e^2)/sum((y-mean(y))^2)
    out <- c(out,list(r2=r2,adjusted_r2=1-(1-r2)*(n-1)/df,residual_se=sqrt(sum(e^2)/df)))
  }
  c(out,list(labels=c('Intercept',labels),coefficients=unname(b),se=unname(se),t=unname(t),p=unname(p),low=unname(b-crit*se),high=unname(b+crit*se)))
}
main <- function() {
  manifest <- fromJSON('manifest.json',simplifyVector=FALSE)
  if(digest(file='analysis-data.json',algo='sha256')!=manifest$dataset$fingerprint)stop('Data SHA-256 mismatch; export exact analysis-data.json from the workspace')
  data <- fromJSON('analysis-data.json',simplifyVector=FALSE);result <- run_analysis(manifest$analysis,data)
  result$versions <- list(R=R.version.string,jsonlite=as.character(packageVersion('jsonlite')),digest=as.character(packageVersion('digest')))
  write_json(result,'r-results.json',auto_unbox=TRUE,pretty=TRUE,digits=NA,na='null',null='null');cat('Wrote r-results.json\n')
}
if(!identical(Sys.getenv('ACAORA_REPRO_TEST'),'1'))main()
