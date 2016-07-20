doctype html
html
  head
    title= titleAndDescription
    link(rel='stylesheet', href='/stylesheets/style.css')
  body
    block content

doctype html
html(lang='en')
  head
    meta(charset='utf-8')
    meta(http-equiv='X-UA-Compatible', content='IE=edge')
    meta(name='viewport', content='width=device-width, initial-scale=1')
    meta(name='description', content='')
    meta(name='author', content='')
    // Bootstrap Core CSS
    link(href='vendor/bootstrap/css/bootstrap.min.css', rel='stylesheet')
    // Theme CSS
    link(href='css/freelancer.min.css', rel='stylesheet')
    // Custom Fonts
    link(href='vendor/font-awesome/css/font-awesome.min.css', rel='stylesheet', type='text/css')
    link(href='https://fonts.googleapis.com/css?family=Montserrat:400,700', rel='stylesheet', type='text/css')
    link(href='https://fonts.googleapis.com/css?family=Lato:400,700,400italic,700italic', rel='stylesheet', type='text/css')
    // HTML5 Shim and Respond.js IE8 support of HTML5 elements and media queries
    // WARNING: Respond.js doesn't work if you view the page via file://
    //if lt IE 9
      script(src='https://oss.maxcdn.com/libs/html5shiv/3.7.0/html5shiv.js')
      script(src='https://oss.maxcdn.com/libs/respond.js/1.4.2/respond.min.js')
  body#page-top.index
    // Navigation
    nav#mainNav.navbar.navbar-default.navbar-fixed-top.navbar-custom
      .container
        // Brand and toggle get grouped for better mobile display
        .navbar-header.page-scroll
          button.navbar-toggle(type='button', data-toggle='collapse', data-target='#bs-example-navbar-collapse-1')
            span.sr-only Toggle navigation
            |  Menu
            i.fa.fa-bars
          a.navbar-brand(href='#page-top')= title
        // Collect the nav links, forms, and other content for toggling
        #bs-example-navbar-collapse-1.collapse.navbar-collapse
          ul.nav.navbar-nav.navbar-right
            li.hidden
              a(href='#page-top')
            li.page-scroll
              a(href='#portfolio') Portfolio
            li.page-scroll
              a(href='#about') About
            li.page-scroll
              a(href='#contact') Contact
        // /.navbar-collapse
      // /.container-fluid
    // Header
    header
      .container
        .row
          .col-lg-12
            img.img-responsive(src='img/jackthebot-logo.png', alt='')
            .intro-text
              span.name= title
              hr.star-light
              span.skills= subtitle
    // Portfolio Grid Section
    section#portfolio
      .container
        .row
          .col-lg-12.text-center
            h2 Portfolio
            hr.star-primary
        .row
          .col-sm-4.portfolio-item
            a.portfolio-link(href='#portfolioModal1', data-toggle='modal')
              .caption
                .caption-content
                  i.fa.fa-search-plus.fa-3x
              img.img-responsive(src='img/portfolio/cabin.png', alt='')
          .col-sm-4.portfolio-item
            a.portfolio-link(href='#portfolioModal2', data-toggle='modal')
              .caption
                .caption-content
                  i.fa.fa-search-plus.fa-3x
              img.img-responsive(src='img/portfolio/cake.png', alt='')
          .col-sm-4.portfolio-item
            a.portfolio-link(href='#portfolioModal3', data-toggle='modal')
              .caption
                .caption-content
                  i.fa.fa-search-plus.fa-3x
              img.img-responsive(src='img/portfolio/circus.png', alt='')
          .col-sm-4.portfolio-item
            a.portfolio-link(href='#portfolioModal4', data-toggle='modal')
              .caption
                .caption-content
                  i.fa.fa-search-plus.fa-3x
              img.img-responsive(src='img/portfolio/game.png', alt='')
          .col-sm-4.portfolio-item
            a.portfolio-link(href='#portfolioModal5', data-toggle='modal')
              .caption
                .caption-content
                  i.fa.fa-search-plus.fa-3x
              img.img-responsive(src='img/portfolio/safe.png', alt='')
          .col-sm-4.portfolio-item
            a.portfolio-link(href='#portfolioModal6', data-toggle='modal')
              .caption
                .caption-content
                  i.fa.fa-search-plus.fa-3x
              img.img-responsive(src='img/portfolio/submarine.png', alt='')
    // About Section
    section#about.success
      .container
        .row
          .col-lg-12.text-center
            h2 About
            hr.star-light
        .row
          .col-lg-4.col-lg-offset-2
            p
              | Freelancer is a free bootstrap theme created by Start Bootstrap. The download includes the complete source files including HTML, CSS, and JavaScript as well as optional LESS stylesheets for easy customization.
          .col-lg-4
            p
              | Whether you're a student looking to showcase your work, a professional looking to attract clients, or a graphic artist looking to share your projects, this template is the perfect starting point!
          .col-lg-8.col-lg-offset-2.text-center
            a.btn.btn-lg.btn-outline(href='#')
              i.fa.fa-download
              |  Download Theme
    // Contact Section
    section#contact
      .container
        .row
          .col-lg-12.text-center
            h2 Contact Me
            hr.star-primary
        .row
          .col-lg-8.col-lg-offset-2
            // To configure the contact form email address, go to mail/contact_me.php and update the email address in the PHP file on line 19.
            // The form should work on most web servers, but if the form is not working you may need to configure your web server differently.
            form#contactForm(name='sentMessage', novalidate='')
              .row.control-group
                .form-group.col-xs-12.floating-label-form-group.controls
                  label Name
                  input#name.form-control(type='text', placeholder='Name', required='', data-validation-required-message='Please enter your name.')
                  p.help-block.text-danger
              .row.control-group
                .form-group.col-xs-12.floating-label-form-group.controls
                  label Email Address
                  input#email.form-control(type='email', placeholder='Email Address', required='', data-validation-required-message='Please enter your email address.')
                  p.help-block.text-danger
              .row.control-group
                .form-group.col-xs-12.floating-label-form-group.controls
                  label Phone Number
                  input#phone.form-control(type='tel', placeholder='Phone Number', required='', data-validation-required-message='Please enter your phone number.')
                  p.help-block.text-danger
              .row.control-group
                .form-group.col-xs-12.floating-label-form-group.controls
                  label Message
                  textarea#message.form-control(rows='5', placeholder='Message', required='', data-validation-required-message='Please enter a message.')
                  p.help-block.text-danger
              br
              #success
              .row
                .form-group.col-xs-12
                  button.btn.btn-success.btn-lg(type='submit') Send
    // Footer
    footer.text-center
      .footer-above
        .container
          .row
            .footer-col.col-md-4
              h3 Location
              p
                | 3481 Melrose Place
                br
                | Beverly Hills, CA 90210
            .footer-col.col-md-4
              h3 Around the Web
              ul.list-inline
                li
                  a.btn-social.btn-outline(href='#')
                    i.fa.fa-fw.fa-facebook
                li
                  a.btn-social.btn-outline(href='#')
                    i.fa.fa-fw.fa-google-plus
                li
                  a.btn-social.btn-outline(href='#')
                    i.fa.fa-fw.fa-twitter
                li
                  a.btn-social.btn-outline(href='#')
                    i.fa.fa-fw.fa-linkedin
                li
                  a.btn-social.btn-outline(href='#')
                    i.fa.fa-fw.fa-dribbble
            .footer-col.col-md-4
              h3 About Freelancer
              p
                | Freelance is a free to use, open source Bootstrap theme created by
                a(href='http://startbootstrap.com') Start Bootstrap
                | .
      .footer-below
        .container
          .row
            .col-lg-12
              | Copyright © Your Website 2016
    // Scroll to Top Button (Only visible on small and extra-small screen sizes)
    .scroll-top.page-scroll.hidden-sm.hidden-xs.hidden-lg.hidden-md
      a.btn.btn-primary(href='#page-top')
        i.fa.fa-chevron-up
    // Portfolio Modals
    #portfolioModal1.portfolio-modal.modal.fade(tabindex='-1', role='dialog', aria-hidden='true')
      .modal-content
        .close-modal(data-dismiss='modal')
          .lr
            .rl
        .container
          .row
            .col-lg-8.col-lg-offset-2
              .modal-body
                h2 Project Title
                hr.star-primary
                img.img-responsive.img-centered(src='img/portfolio/cabin.png', alt='')
                p
                  | Use this area of the page to describe your project. The icon above is part of a free icon set by
                  a(href='https://sellfy.com/p/8Q9P/jV3VZ/') Flat Icons
                  | . On their website, you can download their free set with 16 icons, or you can purchase the entire set with 146 icons for only $12!
                ul.list-inline.item-details
                  li
                    | Client:
                    strong
                      a(href='http://startbootstrap.com') Start Bootstrap
                  li
                    | Date:
                    strong
                      a(href='http://startbootstrap.com') April 2014
                  li
                    | Service:
                    strong
                      a(href='http://startbootstrap.com') Web Development
                button.btn.btn-default(type='button', data-dismiss='modal')
                  i.fa.fa-times
                  |  Close
    #portfolioModal2.portfolio-modal.modal.fade(tabindex='-1', role='dialog', aria-hidden='true')
      .modal-content
        .close-modal(data-dismiss='modal')
          .lr
            .rl
        .container
          .row
            .col-lg-8.col-lg-offset-2
              .modal-body
                h2 Project Title
                hr.star-primary
                img.img-responsive.img-centered(src='img/portfolio/cake.png', alt='')
                p
                  | Use this area of the page to describe your project. The icon above is part of a free icon set by
                  a(href='https://sellfy.com/p/8Q9P/jV3VZ/') Flat Icons
                  | . On their website, you can download their free set with 16 icons, or you can purchase the entire set with 146 icons for only $12!
                ul.list-inline.item-details
                  li
                    | Client:
                    strong
                      a(href='http://startbootstrap.com') Start Bootstrap
                  li
                    | Date:
                    strong
                      a(href='http://startbootstrap.com') April 2014
                  li
                    | Service:
                    strong
                      a(href='http://startbootstrap.com') Web Development
                button.btn.btn-default(type='button', data-dismiss='modal')
                  i.fa.fa-times
                  |  Close
    #portfolioModal3.portfolio-modal.modal.fade(tabindex='-1', role='dialog', aria-hidden='true')
      .modal-content
        .close-modal(data-dismiss='modal')
          .lr
            .rl
        .container
          .row
            .col-lg-8.col-lg-offset-2
              .modal-body
                h2 Project Title
                hr.star-primary
                img.img-responsive.img-centered(src='img/portfolio/circus.png', alt='')
                p
                  | Use this area of the page to describe your project. The icon above is part of a free icon set by
                  a(href='https://sellfy.com/p/8Q9P/jV3VZ/') Flat Icons
                  | . On their website, you can download their free set with 16 icons, or you can purchase the entire set with 146 icons for only $12!
                ul.list-inline.item-details
                  li
                    | Client:
                    strong
                      a(href='http://startbootstrap.com') Start Bootstrap
                  li
                    | Date:
                    strong
                      a(href='http://startbootstrap.com') April 2014
                  li
                    | Service:
                    strong
                      a(href='http://startbootstrap.com') Web Development
                button.btn.btn-default(type='button', data-dismiss='modal')
                  i.fa.fa-times
                  |  Close
    #portfolioModal4.portfolio-modal.modal.fade(tabindex='-1', role='dialog', aria-hidden='true')
      .modal-content
        .close-modal(data-dismiss='modal')
          .lr
            .rl
        .container
          .row
            .col-lg-8.col-lg-offset-2
              .modal-body
                h2 Project Title
                hr.star-primary
                img.img-responsive.img-centered(src='img/portfolio/game.png', alt='')
                p
                  | Use this area of the page to describe your project. The icon above is part of a free icon set by
                  a(href='https://sellfy.com/p/8Q9P/jV3VZ/') Flat Icons
                  | . On their website, you can download their free set with 16 icons, or you can purchase the entire set with 146 icons for only $12!
                ul.list-inline.item-details
                  li
                    | Client:
                    strong
                      a(href='http://startbootstrap.com') Start Bootstrap
                  li
                    | Date:
                    strong
                      a(href='http://startbootstrap.com') April 2014
                  li
                    | Service:
                    strong
                      a(href='http://startbootstrap.com') Web Development
                button.btn.btn-default(type='button', data-dismiss='modal')
                  i.fa.fa-times
                  |  Close
    #portfolioModal5.portfolio-modal.modal.fade(tabindex='-1', role='dialog', aria-hidden='true')
      .modal-content
        .close-modal(data-dismiss='modal')
          .lr
            .rl
        .container
          .row
            .col-lg-8.col-lg-offset-2
              .modal-body
                h2 Project Title
                hr.star-primary
                img.img-responsive.img-centered(src='img/portfolio/safe.png', alt='')
                p
                  | Use this area of the page to describe your project. The icon above is part of a free icon set by
                  a(href='https://sellfy.com/p/8Q9P/jV3VZ/') Flat Icons
                  | . On their website, you can download their free set with 16 icons, or you can purchase the entire set with 146 icons for only $12!
                ul.list-inline.item-details
                  li
                    | Client:
                    strong
                      a(href='http://startbootstrap.com') Start Bootstrap
                  li
                    | Date:
                    strong
                      a(href='http://startbootstrap.com') April 2014
                  li
                    | Service:
                    strong
                      a(href='http://startbootstrap.com') Web Development
                button.btn.btn-default(type='button', data-dismiss='modal')
                  i.fa.fa-times
                  |  Close
    #portfolioModal6.portfolio-modal.modal.fade(tabindex='-1', role='dialog', aria-hidden='true')
      .modal-content
        .close-modal(data-dismiss='modal')
          .lr
            .rl
        .container
          .row
            .col-lg-8.col-lg-offset-2
              .modal-body
                h2 Project Title
                hr.star-primary
                img.img-responsive.img-centered(src='img/portfolio/submarine.png', alt='')
                p
                  | Use this area of the page to describe your project. The icon above is part of a free icon set by
                  a(href='https://sellfy.com/p/8Q9P/jV3VZ/') Flat Icons
                  | . On their website, you can download their free set with 16 icons, or you can purchase the entire set with 146 icons for only $12!
                ul.list-inline.item-details
                  li
                    | Client:
                    strong
                      a(href='http://startbootstrap.com') Start Bootstrap
                  li
                    | Date:
                    strong
                      a(href='http://startbootstrap.com') April 2014
                  li
                    | Service:
                    strong
                      a(href='http://startbootstrap.com') Web Development
                button.btn.btn-default(type='button', data-dismiss='modal')
                  i.fa.fa-times
                  |  Close
    // jQuery
    script(src='vendor/jquery/jquery.min.js')
    // Bootstrap Core JavaScript
    script(src='vendor/bootstrap/js/bootstrap.min.js')
    // Plugin JavaScript
    script(src='http://cdnjs.cloudflare.com/ajax/libs/jquery-easing/1.3/jquery.easing.min.js')
    // Contact Form JavaScript
    script(src='js/jqBootstrapValidation.js')
    script(src='js/contact_me.js')
    // Theme JavaScript
    script(src='js/freelancer.min.js')
